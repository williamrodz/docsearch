"use client"

import { useState, useEffect, useCallback } from "react"
import { Play, Loader2, CheckCircle, AlertCircle, Settings } from "lucide-react"
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
  const [isProcessing, setIsProcessing] = useState(false)
  const [batchSize, setBatchSize] = useState(20)
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{
    processed: number
    failed: number
  } | null>(null)

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

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  const processImages = async () => {
    if (status.pending === 0) {
      setError("No pending images to process")
      return
    }

    setIsProcessing(true)
    setError(null)
    setLastResult(null)

    const batches = Math.ceil(status.pending / batchSize)
    setTotalBatches(batches)
    setCurrentBatch(0)

    let totalProcessed = 0
    let totalFailed = 0

    for (let i = 0; i < batches; i++) {
      setCurrentBatch(i + 1)

      try {
        const response = await fetch(`/api/groups/${groupId}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batch_size: batchSize }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || "Processing failed")
        }

        totalProcessed += result.processed || 0
        totalFailed += result.failed || 0

        // Refresh status after each batch
        await refreshStatus()

        // Check if there are more pending images
        const statusResponse = await fetch(`/api/groups/${groupId}/process`)
        const statusData = await statusResponse.json()

        if (statusData.pending === 0) {
          break
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
        break
      }
    }

    setLastResult({ processed: totalProcessed, failed: totalFailed })
    setIsProcessing(false)
    setCurrentBatch(0)
    setTotalBatches(0)
  }

  const progressPercent =
    status.total > 0
      ? Math.round(((status.completed + status.failed) / status.total) * 100)
      : 0

  const batchSizeOptions = [1, 5, 10, 20, 50]

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
              <Button variant="outline" size="sm">
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
        {/* Progress bar */}
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

        {/* Current batch progress */}
        {isProcessing && totalBatches > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Processing batch {currentBatch} of {totalBatches}...
            </span>
          </div>
        )}

        {/* Last result */}
        {lastResult && !isProcessing && (
          <div className="flex items-center gap-2 text-sm">
            {lastResult.failed === 0 ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-600">
                  Successfully processed {lastResult.processed} images
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-600">
                  Processed {lastResult.processed}, {lastResult.failed} failed
                </span>
              </>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Process button */}
        <Button
          onClick={processImages}
          disabled={isProcessing || status.pending === 0}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Process {status.pending} Pending Images
            </>
          )}
        </Button>

        {status.pending === 0 && status.total > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            All images have been processed
          </p>
        )}
      </CardContent>
    </Card>
  )
}
