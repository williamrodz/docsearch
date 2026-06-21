"use client"

import Link from "next/link"
import Image from "next/image"
import { Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Image as ImageType } from "@/lib/types/database"

interface ImageWithUrl extends ImageType {
  url: string
}

interface ImageGridProps {
  images: ImageWithUrl[]
  groupId: string
}

const statusConfig = {
  pending: {
    label: "Pending",
    icon: Clock,
    variant: "secondary" as const,
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    variant: "warning" as const,
  },
  completed: {
    label: "Processed",
    icon: CheckCircle,
    variant: "success" as const,
  },
  failed: {
    label: "Failed",
    icon: AlertCircle,
    variant: "destructive" as const,
  },
}

export function ImageGrid({ images, groupId }: ImageGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {images.map((image, index) => {
        const status = statusConfig[image.processing_status] || statusConfig.pending
        const StatusIcon = status.icon

        return (
          <Link
            key={image.id}
            href={`/groups/${groupId}/view/${image.id}`}
            className="group relative aspect-[3/4] bg-muted rounded-lg overflow-hidden border hover:border-primary/50 transition-all hover:shadow-md"
          >
            {/* Thumbnail */}
            <div className="absolute inset-0">
              <Image
                src={image.url}
                alt={image.filename}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-200"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
              />
            </div>

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Status badge */}
            <div className="absolute top-2 right-2">
              <Badge variant={status.variant} className="gap-1 text-xs">
                <StatusIcon className={`h-3 w-3 ${status.icon === Loader2 ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{status.label}</span>
              </Badge>
            </div>

            {/* Image number */}
            <div className="absolute top-2 left-2">
              <span className="bg-black/50 text-white text-xs px-2 py-1 rounded">
                #{index + 1}
              </span>
            </div>

            {/* Filename */}
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <p className="text-white text-xs truncate" title={image.filename}>
                {image.filename}
              </p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
