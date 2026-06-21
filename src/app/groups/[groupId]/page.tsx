import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, Images, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { GroupTabs } from "@/components/group-tabs"
import { ProcessingPanel } from "@/components/processing-panel"

interface GroupPageProps {
  params: Promise<{ groupId: string }>
}

export default async function GroupPage({ params }: GroupPageProps) {
  const { groupId } = await params
  const supabase = await createClient()

  // Fetch group with related data
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select(`
      *,
      users:created_by(name)
    `)
    .eq("id", groupId)
    .single()

  if (groupError || !group) {
    notFound()
  }

  // Fetch images
  const { data: images, error: imagesError } = await supabase
    .from("images")
    .select("*")
    .eq("group_id", groupId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("filename", { ascending: true })

  if (imagesError) {
    console.error("Error fetching images:", imagesError)
  }

  // Get public URLs for images
  const imagesWithUrls = (images || []).map((image) => {
    const { data } = supabase.storage
      .from("document-images")
      .getPublicUrl(image.storage_path)

    return {
      ...image,
      url: data.publicUrl,
    }
  })

  // Count stats
  const totalImages = imagesWithUrls.length
  const processedImages = imagesWithUrls.filter(
    (img) => img.processing_status === "completed"
  ).length
  const pendingImages = imagesWithUrls.filter(
    (img) => img.processing_status === "pending"
  ).length
  const failedImages = imagesWithUrls.filter(
    (img) => img.processing_status === "failed"
  ).length

  // Count unique people
  const { count: peopleCount } = await supabase
    .from("people")
    .select("*", { count: "exact", head: true })
    .in("image_id", imagesWithUrls.map((img) => img.id))

  const processingStatus = {
    total: totalImages,
    pending: pendingImages,
    processing: 0,
    completed: processedImages,
    failed: failedImages,
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
            {group.description && (
              <p className="text-muted-foreground mt-1">{group.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span>
                Created {new Date(group.created_at).toLocaleDateString()}
              </span>
              {group.users?.name && <span>by {group.users.name}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href={`/groups/${groupId}/upload`}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Images
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats and Processing */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Stats cards */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Images className="h-4 w-4" />
              <span className="text-sm">Total</span>
            </div>
            <p className="text-2xl font-bold">{totalImages}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span className="text-sm">Processed</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{processedImages}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{pendingImages}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">People</span>
            </div>
            <p className="text-2xl font-bold">{peopleCount || 0}</p>
          </div>
        </div>

        {/* Processing panel */}
        <div className="lg:col-span-1">
          <ProcessingPanel groupId={groupId} initialStatus={processingStatus} />
        </div>
      </div>

      <Separator className="my-6" />

      {/* Tabs */}
      <GroupTabs groupId={groupId} images={imagesWithUrls} />
    </div>
  )
}
