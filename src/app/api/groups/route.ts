import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: groups, error } = await supabase
      .from("groups")
      .select(`
        *,
        images:images(count),
        users:created_by(name)
      `)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching groups:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ groups })
  } catch (error) {
    console.error("Error in GET /api/groups:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, created_by } = body

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name: name.trim(),
        description: description || null,
        created_by: created_by || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating group:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ group }, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/groups:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
