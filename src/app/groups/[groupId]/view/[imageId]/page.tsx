import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ImageViewer } from "@/components/image-viewer"

interface ViewPageProps {
  params: Promise<{ groupId: string; imageId: string }>
}

export default async function ViewPage({ params }: ViewPageProps) {
  const { groupId, imageId } = await params
  const supabase = await createClient()

  // Fetch current image with related data
  const { data: image, error: imageError } = await supabase
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

  if (imageError || !image) {
    notFound()
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("document-images")
    .getPublicUrl(image.storage_path)

  // Fetch all images in group for navigation
  const { data: allImages } = await supabase
    .from("images")
    .select("id, filename, sort_order")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("filename", { ascending: true })

  const imageList = allImages || []
  const currentIndex = imageList.findIndex((img) => img.id === imageId)
  const prevImage = currentIndex > 0 ? imageList[currentIndex - 1] : null
  const nextImage = currentIndex < imageList.length - 1 ? imageList[currentIndex + 1] : null

  // Fetch group name
  const { data: group } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single()

  return (
    <ImageViewer
      image={{
        ...image,
        url: urlData.publicUrl,
      }}
      groupId={groupId}
      groupName={group?.name || "Group"}
      currentIndex={currentIndex}
      totalImages={imageList.length}
      prevImageId={prevImage?.id || null}
      nextImageId={nextImage?.id || null}
    />
  )
}
