import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import Anthropic from "@anthropic-ai/sdk"
import ws from "ws"

// --- Configuration ---

const POLL_INTERVAL_MS = 5000
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
  console.error("Missing required environment variables:")
  if (!SUPABASE_URL) console.error("  - SUPABASE_URL")
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error("  - SUPABASE_SERVICE_ROLE_KEY")
  if (!ANTHROPIC_API_KEY) console.error("  - ANTHROPIC_API_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
})
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// --- Claude Vision prompt (same as src/lib/claude.ts) ---

const EXTRACTION_PROMPT = `You are an expert paleographer and genealogist specializing in 19th century Spanish colonial church records from Puerto Rico. You are analyzing a scanned image of a historical document (likely a baptism, marriage, or death record) written in cursive Spanish.

Your task is to carefully extract information from this document. The handwriting may be difficult to read, so indicate your confidence levels honestly.

Please extract the following and return as JSON:

1. **raw_text**: Transcribe ALL visible text, preserving line breaks with \\n. For unclear text:
   - Use [?word?] for uncertain readings
   - Use [...] for completely illegible sections
   - Preserve original spelling and abbreviations

2. **confidence_score**: Overall legibility rating from 0.0 to 1.0
   - 0.8-1.0: Clearly legible
   - 0.5-0.8: Partially legible with some unclear sections
   - 0.0-0.5: Mostly illegible

3. **alternatives**: Array of alternative readings for uncertain passages:
   [{"text": "uncertain word or phrase", "confidence": 0.7, "location": "line 3"}]

4. **people**: Array of ALL people mentioned with their roles:
   - name: Full name as written
   - role: One of "baptized", "parent", "godparent", "priest", "witness", "spouse", "deceased", "other"
   - confidence: 0.0-1.0 for name accuracy
   - alternatives: [{name: "alternative spelling", confidence: 0.6}] if uncertain

5. **event_date**: The date of the recorded event (baptism/marriage/death):
   - date: ISO format "YYYY-MM-DD" (use "1800-01-01" format, estimate year if unclear)
   - raw: Original text of the date
   - confidence: 0.0-1.0

6. **document_type**: Best guess: "baptism", "marriage", "death", "confirmation", or "other"

7. **notes**: Any relevant observations about the document condition, unusual content, or context

IMPORTANT:
- Spanish colonial records often use abbreviations like "Dn." (Don), "Da." (Doña), "Pbro." (Presbítero)
- Names may include "de" particles and multiple surnames
- Dates use month names in Spanish (enero, febrero, etc.)
- Be thorough in identifying ALL people mentioned, including witnesses

Respond with ONLY valid JSON, no markdown formatting or explanation.`

// --- Core functions ---

async function analyzeDocument(imageUrl) {
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
  }

  const imageBuffer = await imageResponse.arrayBuffer()
  const base64Image = Buffer.from(imageBuffer).toString("base64")

  const contentType = imageResponse.headers.get("content-type") || "image/jpeg"
  const mediaType = contentType.includes("png")
    ? "image/png"
    : contentType.includes("gif")
      ? "image/gif"
      : contentType.includes("webp")
        ? "image/webp"
        : "image/jpeg"

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Image },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  })

  const textContent = response.content.find((block) => block.type === "text")
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude")
  }

  let jsonText = textContent.text.trim()
  if (jsonText.startsWith("```json")) jsonText = jsonText.slice(7)
  if (jsonText.startsWith("```")) jsonText = jsonText.slice(3)
  if (jsonText.endsWith("```")) jsonText = jsonText.slice(0, -3)

  const result = JSON.parse(jsonText.trim())

  return {
    raw_text: result.raw_text || "",
    confidence_score: Math.max(0, Math.min(1, result.confidence_score || 0)),
    alternatives: Array.isArray(result.alternatives) ? result.alternatives : [],
    people: Array.isArray(result.people)
      ? result.people.map((p) => ({
          name: p.name || "Unknown",
          role: p.role || "other",
          confidence: Math.max(0, Math.min(1, p.confidence || 0.5)),
          alternatives: p.alternatives,
        }))
      : [],
    event_date: result.event_date
      ? {
          date: result.event_date.date || "",
          raw: result.event_date.raw || "",
          confidence: Math.max(0, Math.min(1, result.event_date.confidence || 0.5)),
        }
      : null,
    document_type: result.document_type,
    notes: result.notes,
  }
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// --- Job processing ---

async function processJob(job) {
  console.log(`\n=== Processing job ${job.id} (group: ${job.group_id}) ===`)

  if (job.status === "queued") {
    await supabase
      .from("processing_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", job.id)
  }

  const statusFilter = job.retry_failed ? "failed" : "pending"
  let totalProcessed = 0
  let totalFailed = 0

  while (true) {
    // Check if job was cancelled
    const { data: currentJob } = await supabase
      .from("processing_jobs")
      .select("status")
      .eq("id", job.id)
      .single()

    if (currentJob?.status === "cancelled") {
      console.log("Job was cancelled, stopping.")
      return
    }

    // Fetch next batch of images
    const { data: images, error: fetchError } = await supabase
      .from("images")
      .select("*")
      .eq("group_id", job.group_id)
      .eq("processing_status", statusFilter)
      .order("sort_order", { ascending: true })
      .limit(job.batch_size)

    if (fetchError) {
      console.error("Error fetching images:", fetchError.message)
      await supabase
        .from("processing_jobs")
        .update({
          status: "failed",
          error_message: fetchError.message,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", job.id)
      return
    }

    if (!images || images.length === 0) {
      console.log("No more images to process — job complete.")
      await supabase
        .from("processing_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", job.id)
      return
    }

    console.log(`Batch: ${images.length} images to process`)

    for (const image of images) {
      // Re-check cancellation between each image
      const { data: checkJob } = await supabase
        .from("processing_jobs")
        .select("status")
        .eq("id", job.id)
        .single()

      if (checkJob?.status === "cancelled") {
        console.log("Job was cancelled mid-batch, stopping.")
        return
      }

      try {
        // Mark as processing
        await supabase
          .from("images")
          .update({
            processing_status: "processing",
            processing_started_at: new Date().toISOString(),
          })
          .eq("id", image.id)

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("document-images")
          .getPublicUrl(image.storage_path)

        console.log(`  Processing: ${image.filename}...`)
        const extraction = await analyzeDocument(urlData.publicUrl)

        // Update image with results
        await supabase
          .from("images")
          .update({
            processing_status: "completed",
            processed_at: new Date().toISOString(),
            processing_started_at: null,
            raw_text: extraction.raw_text,
            confidence_score: extraction.confidence_score,
            alternatives: extraction.alternatives,
            event_date: extraction.event_date?.date || null,
            event_date_raw: extraction.event_date?.raw || null,
            event_date_confidence: extraction.event_date?.confidence || null,
          })
          .eq("id", image.id)

        // Insert extracted people
        if (extraction.people.length > 0) {
          const peopleToInsert = extraction.people.map((person) => ({
            image_id: image.id,
            name: person.name,
            name_normalized: normalizeName(person.name),
            role: person.role,
            confidence: person.confidence,
            alternatives: person.alternatives || null,
          }))

          await supabase.from("people").insert(peopleToInsert)
        }

        totalProcessed++
        console.log(
          `  ✓ ${image.filename} — confidence: ${(extraction.confidence_score * 100).toFixed(0)}%, ` +
            `${extraction.people.length} people, ` +
            `date: ${extraction.event_date?.raw || "none"}`
        )
      } catch (error) {
        console.error(`  ✗ ${image.filename} — ${error.message}`)

        await supabase
          .from("images")
          .update({
            processing_status: "failed",
            processing_started_at: null,
          })
          .eq("id", image.id)

        totalFailed++
      }

      // Update job progress after each image
      await supabase
        .from("processing_jobs")
        .update({
          processed_count: job.processed_count + totalProcessed,
          failed_count: job.failed_count + totalFailed,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", job.id)
    }
  }
}

// --- Main loop ---

async function pollForJobs() {
  const { data: jobs, error } = await supabase
    .from("processing_jobs")
    .select("*")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })
    .limit(1)

  if (error) {
    console.error("Error polling for jobs:", error.message)
    return
  }

  if (jobs && jobs.length > 0) {
    await processJob(jobs[0])
  }
}

async function main() {
  console.log("DocSearch Worker started")
  console.log(`Supabase: ${SUPABASE_URL}`)
  console.log(`Polling every ${POLL_INTERVAL_MS / 1000}s for jobs...\n`)

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down gracefully...")
    process.exit(0)
  })
  process.on("SIGTERM", () => {
    console.log("\nShutting down gracefully...")
    process.exit(0)
  })

  while (true) {
    try {
      await pollForJobs()
    } catch (error) {
      console.error("Unhandled error in poll loop:", error.message)
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

main()
