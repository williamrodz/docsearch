"use client"

import { useEffect, useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch"
import {
  ArrowLeft,
  ArrowRight,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Check,
  PanelRightClose,
  PanelRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useUser } from "@/components/user-provider"
import type { Image, Person, Inspection } from "@/lib/types/database"

interface ImageWithDetails extends Image {
  url: string
  people?: Person[]
  inspections?: (Inspection & { users?: { name: string } })[]
}

interface ImageViewerProps {
  image: ImageWithDetails
  groupId: string
  groupName: string
  currentIndex: number
  totalImages: number
  prevImageId: string | null
  nextImageId: string | null
}

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls()

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => zoomOut()}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => resetTransform()}>
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => zoomIn()}>
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function ImageViewer({
  image,
  groupId,
  groupName,
  currentIndex,
  totalImages,
  prevImageId,
  nextImageId,
}: ImageViewerProps) {
  const router = useRouter()
  const { currentUser } = useUser()
  const [showSidebar, setShowSidebar] = useState(true)
  const [isMarking, setIsMarking] = useState(false)

  const goToPrev = useCallback(() => {
    if (prevImageId) {
      router.push(`/groups/${groupId}/view/${prevImageId}`)
    }
  }, [prevImageId, groupId, router])

  const goToNext = useCallback(() => {
    if (nextImageId) {
      router.push(`/groups/${groupId}/view/${nextImageId}`)
    }
  }, [nextImageId, groupId, router])

  const handleMarkInspected = async () => {
    if (!currentUser || isMarking) return

    setIsMarking(true)
    try {
      const response = await fetch(`/api/groups/${groupId}/images/${image.id}/inspect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id }),
      })

      if (response.ok) {
        // Auto-advance to next image
        if (nextImageId) {
          goToNext()
        }
      }
    } catch (error) {
      console.error("Failed to mark as inspected:", error)
    } finally {
      setIsMarking(false)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (e.key) {
        case "ArrowLeft":
          goToPrev()
          break
        case "ArrowRight":
          goToNext()
          break
        case "Escape":
          router.push(`/groups/${groupId}`)
          break
        case "Enter":
        case " ":
          e.preventDefault()
          handleMarkInspected()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goToPrev, goToNext, router, groupId])

  // Touch swipe handling
  useEffect(() => {
    let touchStartX = 0
    let touchEndX = 0

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX
    }

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX
      const diff = touchStartX - touchEndX

      // Minimum swipe distance of 50px
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          goToNext()
        } else {
          goToPrev()
        }
      }
    }

    document.addEventListener("touchstart", handleTouchStart)
    document.addEventListener("touchend", handleTouchEnd)

    return () => {
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [goToPrev, goToNext])

  const lastInspection = image.inspections?.[image.inspections.length - 1]

  return (
    <div className="fixed inset-0 bg-background z-50 flex">
      {/* Main viewer area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur">
          <div className="flex items-center gap-4">
            <Link href={`/groups/${groupId}`}>
              <Button variant="ghost" size="icon">
                <X className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
                {image.filename}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentIndex + 1} of {totalImages} in {groupName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TransformWrapper>
              <ZoomControls />
            </TransformWrapper>

            <Separator orientation="vertical" className="h-6" />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(!showSidebar)}
              className="hidden md:flex"
            >
              {showSidebar ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Image area */}
        <div className="flex-1 relative bg-black/90">
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            centerOnInit
            wheel={{ step: 0.1 }}
          >
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={image.url}
                alt={image.filename}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            </TransformComponent>
          </TransformWrapper>

          {/* Navigation arrows */}
          <button
            onClick={goToPrev}
            disabled={!prevImageId}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            disabled={!nextImageId}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Bottom bar - mobile */}
        <div className="h-16 border-t flex items-center justify-between px-4 md:hidden bg-background">
          <Button variant="outline" onClick={goToPrev} disabled={!prevImageId}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Prev
          </Button>

          <Button
            onClick={handleMarkInspected}
            disabled={!currentUser || isMarking}
          >
            <Check className="h-4 w-4 mr-2" />
            Mark Inspected
          </Button>

          <Button variant="outline" onClick={goToNext} disabled={!nextImageId}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div className="hidden md:flex w-80 border-l flex-col bg-background">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Image Details</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Status and Confidence */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Status
              </h4>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    image.processing_status === "completed"
                      ? "success"
                      : image.processing_status === "failed"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {image.processing_status}
                </Badge>
                {image.confidence_score !== null && image.confidence_score !== undefined && (
                  <Badge
                    variant={
                      image.confidence_score >= 0.8
                        ? "success"
                        : image.confidence_score >= 0.5
                        ? "warning"
                        : "destructive"
                    }
                  >
                    {Math.round(image.confidence_score * 100)}% confidence
                  </Badge>
                )}
              </div>
            </div>

            {/* Inspection status */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Inspection
              </h4>
              {lastInspection ? (
                <p className="text-sm">
                  Inspected by {lastInspection.users?.name || "Unknown"} on{" "}
                  {new Date(lastInspection.inspected_at).toLocaleDateString()}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Not yet inspected</p>
              )}
            </div>

            {/* Transcribed text */}
            {image.raw_text && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Transcribed Text
                </h4>
                <div className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg max-h-64 overflow-y-auto font-serif leading-relaxed">
                  {image.raw_text.split(/(\[.*?\])/).map((part, i) => {
                    // Highlight uncertain text [?word?] in yellow
                    if (part.startsWith("[?") && part.endsWith("?]")) {
                      return (
                        <span key={i} className="bg-yellow-200 dark:bg-yellow-900 px-0.5 rounded" title="Uncertain reading">
                          {part}
                        </span>
                      )
                    }
                    // Highlight illegible sections [...] in red
                    if (part === "[...]") {
                      return (
                        <span key={i} className="bg-red-200 dark:bg-red-900 px-0.5 rounded" title="Illegible section">
                          {part}
                        </span>
                      )
                    }
                    return <span key={i}>{part}</span>
                  })}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-yellow-200 dark:bg-yellow-900 rounded" />
                    Uncertain
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-red-200 dark:bg-red-900 rounded" />
                    Illegible
                  </span>
                </div>
              </div>
            )}

            {/* People */}
            {image.people && image.people.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  People Mentioned ({image.people.length})
                </h4>
                <div className="space-y-2">
                  {image.people.map((person) => {
                    const confidence = person.confidence || 0.5
                    const borderColor =
                      confidence >= 0.8
                        ? "border-green-500"
                        : confidence >= 0.5
                        ? "border-yellow-500"
                        : "border-red-500"

                    return (
                      <div
                        key={person.id}
                        className={`p-2 rounded border-l-4 ${borderColor} bg-muted/50`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{person.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(confidence * 100)}%
                          </span>
                        </div>
                        {person.role && (
                          <span className="text-xs text-muted-foreground capitalize">
                            {person.role}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Event date */}
            {image.event_date && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Event Date
                </h4>
                <div className="flex items-center gap-2">
                  <p className="text-sm">
                    {new Date(image.event_date).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  {image.event_date_confidence !== null && image.event_date_confidence !== undefined && (
                    <Badge
                      variant={
                        image.event_date_confidence >= 0.8
                          ? "success"
                          : image.event_date_confidence >= 0.5
                          ? "warning"
                          : "destructive"
                      }
                      className="text-xs"
                    >
                      {Math.round(image.event_date_confidence * 100)}%
                    </Badge>
                  )}
                </div>
                {image.event_date_raw && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Original: &quot;{image.event_date_raw}&quot;
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Bottom action */}
          <div className="p-4 border-t">
            <Button
              className="w-full"
              onClick={handleMarkInspected}
              disabled={!currentUser || isMarking}
            >
              <Check className="h-4 w-4 mr-2" />
              {isMarking ? "Marking..." : "Mark as Inspected"}
            </Button>
            {!currentUser && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Select a user to mark as inspected
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
