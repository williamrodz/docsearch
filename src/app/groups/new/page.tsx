"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useUser } from "@/components/user-provider"

export default function NewGroupPage() {
  const router = useRouter()
  const { currentUser } = useUser()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError("Please enter a group name")
      return
    }

    if (!currentUser) {
      setError("Please select a user first")
      return
    }

    setIsCreating(true)
    setError("")

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          created_by: currentUser.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create group")
      }

      const { group } = await response.json()
      router.push(`/groups/${group.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create group")
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="container py-8 max-w-2xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Groups
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create New Group</CardTitle>
          <CardDescription>
            Create a collection to organize your document images for analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Group Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="name"
                placeholder="e.g., Bautismos 1806-1830"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="description"
                placeholder="Optional description of this document collection"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isCreating}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {!currentUser && (
              <p className="text-sm text-warning">
                Please select or create a user from the header menu before creating a group.
              </p>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating || !currentUser}>
                {isCreating ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
