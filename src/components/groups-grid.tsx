"use client"

import Link from "next/link"
import { FolderOpen, Images, Calendar, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface GroupWithMeta {
  id: string
  name: string
  description: string | null
  created_at: string
  image_count: number
  creator_name: string | null
}

interface GroupsGridProps {
  groups: GroupWithMeta[]
}

export function GroupsGrid({ groups }: GroupsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <Link key={group.id} href={`/groups/${group.id}`}>
          <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  <Images className="h-3 w-3 mr-1" />
                  {group.image_count}
                </Badge>
              </div>
              {group.description && (
                <CardDescription className="line-clamp-2">
                  {group.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(group.created_at).toLocaleDateString()}
                </div>
                {group.creator_name && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {group.creator_name}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
