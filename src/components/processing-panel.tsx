"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Play, Loader2, CheckCircle, AlertCircle, Settings, X, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProcessingJob } from "@/lib/types/database"

interface ProcessingStatus {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
}

interface ProcessingPanelProps {
  groupId: string
  initialStatus?: ProcessingStatus
}

export function ProcessingPanel({ groupId, initialStatus }: ProcessingPanelProps) {
  const [status, setStatus] = useState<ProcessingStatus>(
    initialStatus || { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
  )
  const [activeJob, setActiveJob] = useState<ProcessingJob | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [batchSize, setBatchSize] = useState(20)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/process`)
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (err) {
      console.error("Failed to refresh status:", err)
    }
  }, [groupId])

  const checkForActiveJob = useCallback(async () => {
    try {
      const response = await fetch(`/api/jobs?group_id=${groupId}`)
      if (response.ok) {
        const jobs = await response.json()
        const active = jobs.find((j: ProcessingJob) =>
          j.status === "queued" || j.status === "running"
        )
        if (active) {
          setActiveJob(active)
          startPolling(active.id)
        }
      }
    } catch (err) {
      console.error("Failed to check for active job:", err)
    }
  }, [groupId])

  useEffect(() => {
    refreshStatus()
    checkForActiveJob()

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [refreshStatus, checkForActiveJob])

  const startPolling = (jobId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}`)
        if (response.ok) {
          const job = await response.json()
          setActiveJob(job)

          await refreshStatus()

          if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
          }
        }
      } catch (err) {
        console.error("Failed to poll job status:", err)
      }
    }, 3000)
  }

  const startJob = async (retryFailed = false) => {
    const imagesToProcess = retryFailed ? status.failed : status.pending
    if (imagesToProcess === 0) {
      setError(retryFailed ? "No failed images to retry" : "No pending images to process")
      return
    }

    setIsStarting(true)
    setError(null)

    try {
      // Create the job
      const createResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: groupId,
          retry_failed: retryFailed,
          batch_size: batchSize,
        }),
      })

      const createResult = await createResponse.json()

      if (!createResponse.ok) {
        throw new Error(createResult.error || "Failed to create job")
      }

      setActiveJob(createResult)

      // Worker on the server will pick up the job automatically.
      // Start polling for progress
      startPolling(createResult.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setIsStarting(false)
    }
  }

  const cancelJob = async () => {
    if (!activeJob) return

    try {
      const response = await fetch(`/api/jobs/${activeJob.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        setActiveJob(null)
        await refreshStatus()
      } else {
        const result = await response.json()
        setError(result.error || "Failed to cancel job")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  const progressPercent =
    status.total > 0
      ? Math.round(((status.completed + status.failed) / status.total) * 100)
      : 0

  const jobProgressPercent =
    activeJob && activeJob.total_images > 0
      ? Math.round(((activeJob.processed_count + activeJob.failed_count) / activeJob.total_images) * 100)
      : 0

  const batchSizeOptions = [1, 5, 10, 20, 50]

  const isJobActive = activeJob && (activeJob.status === "queued" || activeJob.status === "running")

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">AI Processing</CardTitle>
            <CardDescription>
              Extract text, names, and dates using Claude Vision
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!!isJobActive}>
                <Settings className="h-4 w-4 mr-2" />
                Batch: {batchSize}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Images per batch</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {batchSizeOptions.map((size) => (
                <DropdownMenuItem
                  key={size}
                  onClick={() => setBatchSize(size)}
                  className={batchSize === size ? "bg-accent" : ""}
                >
                  {size} images
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall progress bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span>
              {status.completed} of {status.total} processed
            </span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} />
        </div>

        {/* Status breakdown */}
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div className="p-2 rounded bg-muted">
            <div className="text-lg font-bold">{status.pending}</div>
            <div className="text-muted-foreground">Pending</div>
          </div>
          <div className="p-2 rounded bg-blue-500/10">
            <div className="text-lg font-bold text-blue-600">{status.processing}</div>
            <div className="text-muted-foreground">Processing</div>
          </div>
          <div className="p-2 rounded bg-green-500/10">
            <div className="text-lg font-bold text-green-600">{status.completed}</div>
            <div className="text-muted-foreground">Completed</div>
          </div>
          <div className="p-2 rounded bg-red-500/10">
            <div className="text-lg font-bold text-red-600">{status.failed}</div>
            <div className="text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Active job status */}
        {isJobActive && (
          <div className="p-3 rounded-lg border bg-blue-500/5 border-blue-500/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span>Job running...</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelJob}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
            <div className="space-y-2">
              <Progress value={jobProgressPercent} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {activeJob.processed_count + activeJob.failed_count} / {activeJob.total_images} images
                </span>
                <span>{jobProgressPercent}%</span>
              </div>
              {activeJob.failed_count > 0 && (
                <div className="text-xs text-yellow-600">
                  {activeJob.failed_count} failed so far
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              You can close this page. Processing will continue in the background.
            </p>
          </div>
        )}

        {/* Completed job message */}
        {activeJob && activeJob.status === "completed" && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>
              Job completed: {activeJob.processed_count} processed
              {activeJob.failed_count > 0 && `, ${activeJob.failed_count} failed`}
            </span>
          </div>
        )}

        {/* Failed job message */}
        {activeJob && activeJob.status === "failed" && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>Job failed: {activeJob.error_message || "Unknown error"}</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Process buttons */}
        {!isJobActive && (
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => startJob(false)}
              disabled={isStarting || status.pending === 0}
              className="w-full"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Process {status.pending} Pending Images
                </>
              )}
            </Button>

            {status.failed > 0 && (
              <Button
                onClick={() => startJob(true)}
                disabled={isStarting}
                variant="outline"
                className="w-full"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Retry {status.failed} Failed Images
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {status.pending === 0 && status.failed === 0 && status.total > 0 && !isJobActive && (
          <p className="text-sm text-muted-foreground text-center">
            All images have been processed
          </p>
        )}
      </CardContent>
    </Card>
  )
}
