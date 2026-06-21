import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { analyzeDocument, normalizeName } from "@/lib/claude"

export const maxDuration = 300 // 5 minutes max for Vercel

// POST /api/jobs/[jobId]/process - Process one batch for a job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const startTime = Date.now()
  const maxProcessingTime = 240000 // 4 minutes (leave buffer for cleanup)

  try {
    const { jobId } = await params
    const supabase = await createClient()

    // Get the job
    const { data: job, error: jobError } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("id", jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Check if job should continue
    if (job.status === "cancelled" || job.status === "completed" || job.status === "failed") {
      return NextResponse.json({
        message: `Job is ${job.status}`,
        completed: true,
        processed: 0,
        remaining: 0,
      })
    }

    // Update job status to running
    if (job.status === "queued") {
      await supabase
        .from("processing_jobs")
        .update({
          status: "running",
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", jobId)
    } else {
      await supabase
        .from("processing_jobs")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", jobId)
    }

    // Get images to process
    const statusFilter = job.retry_failed ? "failed" : "pending"
    const { data: images, error: fetchError } = await supabase
      .from("images")
      .select("*")
      .eq("group_id", job.group_id)
      .eq("processing_status", statusFilter)
      .order("sort_order", { ascending: true })
      .limit(job.batch_size)

    if (fetchError) {
      console.error("Error fetching images:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!images || images.length === 0) {
      // No more images to process - job is complete
      await supabase
        .from("processing_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", jobId)

      return NextResponse.json({
        message: "Job completed",
        completed: true,
        processed: 0,
        remaining: 0,
      })
    }

    let processedCount = 0
    let failedCount = 0

    // Process each image
    for (const image of images) {
      // Check if we're running out of time
      if (Date.now() - startTime > maxProcessingTime) {
        console.log("Approaching timeout, stopping batch early")
        break
      }

      // Re-check job status in case it was cancelled
      const { data: currentJob } = await supabase
        .from("processing_jobs")
        .select("status")
        .eq("id", jobId)
        .single()

      if (currentJob?.status === "cancelled") {
        console.log("Job was cancelled, stopping")
        break
      }

      try {
        // Mark image as processing
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

        // Analyze with Claude Vision
        const extraction = await analyzeDocument(urlData.publicUrl)

        // Update image with extracted data
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

        processedCount++
      } catch (error) {
        console.error(`Error processing image ${image.id}:`, error)

        // Mark as failed
        await supabase
          .from("images")
          .update({
            processing_status: "failed",
            processing_started_at: null,
          })
          .eq("id", image.id)

        failedCount++
      }
    }

    // Update job progress
    const { data: updatedJob } = await supabase
      .from("processing_jobs")
      .update({
        processed_count: job.processed_count + processedCount,
        failed_count: job.failed_count + failedCount,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .select()
      .single()

    // Count remaining images
    const { count: remaining } = await supabase
      .from("images")
      .select("*", { count: "exact", head: true })
      .eq("group_id", job.group_id)
      .eq("processing_status", statusFilter)

    const isComplete = !remaining || remaining === 0

    if (isComplete) {
      await supabase
        .from("processing_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId)
    } else {
      // Trigger next batch (fire-and-forget)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      fetch(`${baseUrl}/api/jobs/${jobId}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-trigger": "true",
        },
      }).catch((err) => {
        console.error("Failed to trigger next batch:", err)
        // Job can be resumed manually or via cron if this fails
      })
    }

    return NextResponse.json({
      message: isComplete ? "Job completed" : "Batch processed",
      completed: isComplete,
      processed: processedCount,
      failed: failedCount,
      remaining: remaining || 0,
      job: updatedJob,
    })
  } catch (error) {
    console.error("Error in POST /api/jobs/[jobId]/process:", error)

    // Try to mark job as failed
    try {
      const { jobId } = await params
      const supabase = await createClient()
      await supabase
        .from("processing_jobs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", jobId)
    } catch (e) {
      console.error("Failed to update job status:", e)
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
