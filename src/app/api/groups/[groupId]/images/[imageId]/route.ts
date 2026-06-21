import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; imageId: string }> }
) {
  try {
    const { groupId, imageId } = await params
    const supabase = await createClient()

    const { data: image, error } = await supabase
      .from("images")
      .select(`
        *,
        people(*),
        inspections(
          *,
          users:user_id(name)
        )
      `)
      .eq("id", imageId)
      .eq("group_id", groupId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Image not found" }, { status: 404 })
      }
      console.error("Error fetching image:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("document-images")
      .getPublicUrl(image.storage_path)

    return NextResponse.json({
      image: {
        ...image,
        url: urlData.publicUrl,
      },
    })
  } catch (error) {
    console.error("Error in GET /api/groups/[groupId]/images/[imageId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; imageId: string }> }
) {
  try {
    const { groupId, imageId } = await params
    const body = await request.json()
    const supabase = await createClient()

    // Only allow updating certain fields
    const allowedFields = [
      "raw_text",
      "confidence_score",
      "alternatives",
      "event_date",
      "event_date_raw",
      "event_date_confidence",
      "processing_status",
      "processed_at",
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      )
    }

    const { data: image, error } = await supabase
      .from("images")
      .update(updates)
      .eq("id", imageId)
      .eq("group_id", groupId)
      .select()
      .single()

    if (error) {
      console.error("Error updating image:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ image })
  } catch (error) {
    console.error("Error in PATCH /api/groups/[groupId]/images/[imageId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; imageId: string }> }
) {
  try {
    const { groupId, imageId } = await params
    const supabase = await createClient()

    // Get image to find storage path
    const { data: image, error: fetchError } = await supabase
      .from("images")
      .select("storage_path")
      .eq("id", imageId)
      .eq("group_id", groupId)
      .single()

    if (fetchError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 })
    }

    // Delete from storage
    await supabase.storage.from("document-images").remove([image.storage_path])

    // Delete from database
    const { error } = await supabase
      .from("images")
      .delete()
      .eq("id", imageId)
      .eq("group_id", groupId)

    if (error) {
      console.error("Error deleting image:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/groups/[groupId]/images/[imageId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
