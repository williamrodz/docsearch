import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { analyzeDocument, normalizeName } from "@/lib/claude"

export const maxDuration = 300 // 5 minutes max for Vercel

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params
    const body = await request.json()
    const { batch_size = 20, image_ids, retry_failed = false } = body

    // Validate batch size
    const batchSize = Math.max(1, Math.min(50, batch_size))

    const supabase = await createClient()

    // Get images to process
    let query = supabase
      .from("images")
      .select("*")
      .eq("group_id", groupId)
      .eq("processing_status", retry_failed ? "failed" : "pending")
      .order("sort_order", { ascending: true })
      .limit(batchSize)

    // If specific image IDs provided, filter to those
    if (image_ids && Array.isArray(image_ids) && image_ids.length > 0) {
      query = supabase
        .from("images")
        .select("*")
        .eq("group_id", groupId)
        .in("id", image_ids)
        .limit(batchSize)
    }

    const { data: images, error: fetchError } = await query

    if (fetchError) {
      console.error("Error fetching images:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!images || images.length === 0) {
      return NextResponse.json({
        message: "No pending images to process",
        processed: 0,
        failed: 0,
      })
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as { image_id: string; filename: string; error: string }[],
    }

    // Process each image
    for (const image of images) {
      try {
        // Mark as processing
        await supabase
          .from("images")
          .update({ processing_status: "processing" })
          .eq("id", image.id)

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("document-images")
          .getPublicUrl(image.storage_path)

        // Analyze with Claude Vision
        const extraction = await analyzeDocument(urlData.publicUrl)

        // Update image with extracted data
        const { error: updateError } = await supabase
          .from("images")
          .update({
            processing_status: "completed",
            processed_at: new Date().toISOString(),
            raw_text: extraction.raw_text,
            confidence_score: extraction.confidence_score,
            alternatives: extraction.alternatives,
            event_date: extraction.event_date?.date || null,
            event_date_raw: extraction.event_date?.raw || null,
            event_date_confidence: extraction.event_date?.confidence || null,
          })
          .eq("id", image.id)

        if (updateError) {
          throw new Error(`Failed to update image: ${updateError.message}`)
        }

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

          const { error: peopleError } = await supabase
            .from("people")
            .insert(peopleToInsert)

          if (peopleError) {
            console.error("Error inserting people:", peopleError)
            // Don't fail the whole process for people insertion errors
          }
        }

        results.processed++
      } catch (error) {
        console.error(`Error processing image ${image.id}:`, error)

        // Mark as failed
        await supabase
          .from("images")
          .update({ processing_status: "failed" })
          .eq("id", image.id)

        results.failed++
        results.errors.push({
          image_id: image.id,
          filename: image.filename,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    return NextResponse.json({
      message: `Processed ${results.processed} images, ${results.failed} failed`,
      ...results,
    })
  } catch (error) {
    console.error("Error in POST /api/groups/[groupId]/process:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET endpoint to check processing status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params
    const supabase = await createClient()

    // Get counts by status
    const { data: images, error } = await supabase
      .from("images")
      .select("processing_status")
      .eq("group_id", groupId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const counts = {
      total: images?.length || 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    }

    images?.forEach((img) => {
      const status = img.processing_status as keyof typeof counts
      if (status in counts) {
        counts[status]++
      }
    })

    return NextResponse.json(counts)
  } catch (error) {
    console.error("Error in GET /api/groups/[groupId]/process:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
