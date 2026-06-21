import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// GET /api/jobs/[jobId] - Get job status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createClient()

    const { data: job, error } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("id", jobId)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error("Error in GET /api/jobs/[jobId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/jobs/[jobId] - Cancel a job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const supabase = await createClient()

    // Get the job first
    const { data: job, error: fetchError } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("id", jobId)
      .single()

    if (fetchError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    if (job.status === "completed" || job.status === "cancelled") {
      return NextResponse.json(
        { error: "Job is already " + job.status },
        { status: 400 }
      )
    }

    // Cancel the job
    const { error: updateError } = await supabase
      .from("processing_jobs")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Reset any images stuck in "processing" back to their original status
    await supabase
      .from("images")
      .update({
        processing_status: job.retry_failed ? "failed" : "pending",
        processing_started_at: null,
      })
      .eq("group_id", job.group_id)
      .eq("processing_status", "processing")

    return NextResponse.json({ message: "Job cancelled" })
  } catch (error) {
    console.error("Error in DELETE /api/jobs/[jobId]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
