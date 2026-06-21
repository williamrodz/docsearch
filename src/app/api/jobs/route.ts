import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// POST /api/jobs - Create a new processing job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { group_id, retry_failed = false, batch_size = 20, created_by } = body

    if (!group_id) {
      return NextResponse.json({ error: "group_id is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if there's already an active job for this group
    const { data: existingJob } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("group_id", group_id)
      .in("status", ["queued", "running"])
      .single()

    if (existingJob) {
      return NextResponse.json(
        { error: "A job is already running for this group", job: existingJob },
        { status: 409 }
      )
    }

    // Count images to process
    const statusFilter = retry_failed ? "failed" : "pending"
    const { count: totalImages } = await supabase
      .from("images")
      .select("*", { count: "exact", head: true })
      .eq("group_id", group_id)
      .eq("processing_status", statusFilter)

    if (!totalImages || totalImages === 0) {
      return NextResponse.json(
        { error: `No ${statusFilter} images to process` },
        { status: 400 }
      )
    }

    // Create the job
    const { data: job, error: createError } = await supabase
      .from("processing_jobs")
      .insert({
        group_id,
        created_by: created_by || null,
        retry_failed,
        batch_size: Math.max(1, Math.min(50, batch_size)),
        total_images: totalImages,
        status: "queued",
      })
      .select()
      .single()

    if (createError) {
      console.error("Error creating job:", createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/jobs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/jobs - List jobs for a group
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get("group_id")

    if (!groupId) {
      return NextResponse.json({ error: "group_id is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: jobs, error } = await supabase
      .from("processing_jobs")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(jobs)
  } catch (error) {
    console.error("Error in GET /api/jobs:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
