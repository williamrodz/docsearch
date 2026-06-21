"use client"

import { Images, Users, Calendar, Search } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ImageGrid } from "@/components/image-grid"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/empty-state"
import type { Image } from "@/lib/types/database"

interface ImageWithUrl extends Image {
  url: string
}

interface GroupTabsProps {
  groupId: string
  images: ImageWithUrl[]
}

export function GroupTabs({ groupId, images }: GroupTabsProps) {
  return (
    <Tabs defaultValue="images" className="w-full">
      <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
        <TabsTrigger value="images" className="gap-2">
          <Images className="h-4 w-4" />
          <span className="hidden sm:inline">Images</span>
        </TabsTrigger>
        <TabsTrigger value="people" className="gap-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">People</span>
        </TabsTrigger>
        <TabsTrigger value="dates" className="gap-2">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Dates</span>
        </TabsTrigger>
        <TabsTrigger value="search" className="gap-2">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="images" className="mt-6">
        {images.length === 0 ? (
          <EmptyState
            title="No images yet"
            description="Upload document images to start analyzing them."
            actionLabel="Upload Images"
            actionHref={`/groups/${groupId}/upload`}
            icon={<Images className="h-8 w-8 text-muted-foreground" />}
          />
        ) : (
          <ImageGrid images={images} groupId={groupId} />
        )}
      </TabsContent>

      <TabsContent value="people" className="mt-6">
        <EmptyState
          title="No people extracted yet"
          description="Process your images to extract names of people mentioned in the documents."
          icon={<Users className="h-8 w-8 text-muted-foreground" />}
        />
      </TabsContent>

      <TabsContent value="dates" className="mt-6">
        <EmptyState
          title="No dates extracted yet"
          description="Process your images to extract dates from the documents."
          icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
        />
      </TabsContent>

      <TabsContent value="search" className="mt-6">
        <div className="max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search transcribed text, names, dates..."
              className="pl-10"
              disabled
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Search will be available after processing images.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  )
}
