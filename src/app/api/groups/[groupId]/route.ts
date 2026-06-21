import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params
    const supabase = await createClient()

    const { data: group, error } = await supabase
      .from("groups")
      .select(`
        *,
        users:created_by(name),
        images(count)
      `)
      .eq("id", groupId)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Group not found" }, { status: 404 })
      }
      console.error("Error fetching group:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      group: {
        ...group,
        image_count: group.images?.[0]?.count || 0,
        creator_name: group.users?.name || null,
      },
    })
  } catch (error) {
    console.error("Error in GET /api/groups/[groupId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params
    const supabase = await createClient()

    // Delete all images from storage first
    const { data: images } = await supabase
      .from("images")
      .select("storage_path")
      .eq("group_id", groupId)

    if (images && images.length > 0) {
      const paths = images.map((img) => img.storage_path)
      await supabase.storage.from("document-images").remove(paths)
    }

    // Delete the group (cascades to images table)
    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("id", groupId)

    if (error) {
      console.error("Error deleting group:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/groups/[groupId]:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
