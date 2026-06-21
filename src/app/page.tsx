import { createClient } from "@/lib/supabase/server"
import { GroupsGrid } from "@/components/groups-grid"
import { EmptyState } from "@/components/empty-state"

export default async function HomePage() {
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
  }

  const groupsWithCounts = (groups || []).map(group => ({
    ...group,
    image_count: group.images?.[0]?.count || 0,
    creator_name: group.users?.name || null,
  }))

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Document Groups</h1>
        <p className="text-muted-foreground mt-2">
          Organize and analyze your historical document collections
        </p>
      </div>

      {groupsWithCounts.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create your first document group to get started with analyzing historical records."
          actionLabel="Create Group"
          actionHref="/groups/new"
        />
      ) : (
        <GroupsGrid groups={groupsWithCounts} />
      )}
    </div>
  )
}
