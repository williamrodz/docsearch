import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params
    const supabase = await createClient()

    const { data: images, error } = await supabase
      .from("images")
      .select("*")
      .eq("group_id", groupId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("filename", { ascending: true })

    if (error) {
      console.error("Error fetching images:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get public URLs for each image
    const imagesWithUrls = images.map((image) => {
      const { data } = supabase.storage
        .from("document-images")
        .getPublicUrl(image.storage_path)

      return {
        ...image,
        url: data.publicUrl,
      }
    })

    return NextResponse.json({ images: imagesWithUrls })
  } catch (error) {
    console.error("Error in GET /api/groups/[groupId]/images:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params
    const supabase = await createClient()

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      )
    }

    // Verify group exists
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .select("id")
      .eq("id", groupId)
      .single()

    if (groupError || !group) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      )
    }

    // Get current max sort_order
    const { data: maxOrder } = await supabase
      .from("images")
      .select("sort_order")
      .eq("group_id", groupId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single()

    let sortOrder = (maxOrder?.sort_order || 0) + 1

    const uploadedImages = []
    const errors = []

    for (const file of files) {
      try {
        // Create unique storage path
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
        const storagePath = `${groupId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("document-images")
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) {
          errors.push({ filename: file.name, error: uploadError.message })
          continue
        }

        // Create database record
        const { data: image, error: dbError } = await supabase
          .from("images")
          .insert({
            group_id: groupId,
            filename: file.name,
            storage_path: storagePath,
            sort_order: sortOrder++,
            processing_status: "pending",
          })
          .select()
          .single()

        if (dbError) {
          // Clean up uploaded file
          await supabase.storage.from("document-images").remove([storagePath])
          errors.push({ filename: file.name, error: dbError.message })
          continue
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("document-images")
          .getPublicUrl(storagePath)

        uploadedImages.push({
          ...image,
          url: urlData.publicUrl,
        })
      } catch (err) {
        errors.push({
          filename: file.name,
          error: err instanceof Error ? err.message : "Unknown error",
        })
      }
    }

    return NextResponse.json(
      {
        images: uploadedImages,
        errors: errors.length > 0 ? errors : undefined,
        uploaded: uploadedImages.length,
        failed: errors.length,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error in POST /api/groups/[groupId]/images:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
