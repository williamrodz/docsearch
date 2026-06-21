import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ExtractedPerson {
  name: string
  role: "baptized" | "parent" | "godparent" | "priest" | "witness" | "spouse" | "deceased" | "other"
  confidence: number
  alternatives?: { name: string; confidence: number }[]
}

export interface ExtractedDate {
  date: string // ISO format YYYY-MM-DD
  raw: string // Original text
  confidence: number
}

export interface TextAlternative {
  text: string
  confidence: number
  location?: string // Description of where in the document
}

export interface ExtractionResult {
  raw_text: string
  confidence_score: number
  alternatives: TextAlternative[]
  people: ExtractedPerson[]
  event_date: ExtractedDate | null
  document_type?: string
  notes?: string
}

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

export async function analyzeDocument(imageUrl: string): Promise<ExtractionResult> {
  // Fetch the image and convert to base64
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.statusText}`)
  }

  const imageBuffer = await imageResponse.arrayBuffer()
  const base64Image = Buffer.from(imageBuffer).toString("base64")

  // Determine media type
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
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Image,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  })

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === "text")
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude")
  }

  // Parse JSON response
  let result: ExtractionResult
  try {
    // Clean the response - remove markdown code blocks if present
    let jsonText = textContent.text.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.slice(7)
    }
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith("```")) {
      jsonText = jsonText.slice(0, -3)
    }

    result = JSON.parse(jsonText.trim())
  } catch (e) {
    console.error("Failed to parse Claude response:", textContent.text)
    throw new Error(`Failed to parse extraction result: ${e}`)
  }

  // Validate and normalize the result
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

// Normalize name for matching (lowercase, remove accents, trim)
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z\s]/g, "") // Remove non-letters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
}
