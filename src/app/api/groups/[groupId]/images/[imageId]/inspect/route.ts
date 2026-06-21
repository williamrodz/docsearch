import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; imageId: string }> }
) {
  try {
    const { groupId, imageId } = await params
    const body = await request.json()
    const { user_id, notes } = body

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify image exists in this group
    const { data: image, error: imageError } = await supabase
      .from("images")
      .select("id")
      .eq("id", imageId)
      .eq("group_id", groupId)
      .single()

    if (imageError || !image) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      )
    }

    // Create inspection record
    const { data: inspection, error } = await supabase
      .from("inspections")
      .insert({
        image_id: imageId,
        user_id,
        notes: notes || null,
      })
      .select(`
        *,
        users:user_id(name)
      `)
      .single()

    if (error) {
      console.error("Error creating inspection:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ inspection }, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/groups/[groupId]/images/[imageId]/inspect:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string; imageId: string }> }
) {
  try {
    const { groupId, imageId } = await params
    const supabase = await createClient()

    const { data: inspections, error } = await supabase
      .from("inspections")
      .select(`
        *,
        users:user_id(name)
      `)
      .eq("image_id", imageId)
      .order("inspected_at", { ascending: false })

    if (error) {
      console.error("Error fetching inspections:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ inspections })
  } catch (error) {
    console.error("Error in GET /api/groups/[groupId]/images/[imageId]/inspect:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
