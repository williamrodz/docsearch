"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { use } from "react"

interface UploadPageProps {
  params: Promise<{ groupId: string }>
}

interface FileWithPreview {
  file: File
  preview: string
  status: "pending" | "uploading" | "success" | "error"
  error?: string
}

export default function UploadPage({ params }: UploadPageProps) {
  const { groupId } = use(params)
  const router = useRouter()
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)
    const imageFiles = fileArray.filter((f) =>
      f.type.startsWith("image/")
    )

    const newFileItems: FileWithPreview[] = imageFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
    }))

    setFiles((prev) => [...prev, ...newFileItems])
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }, [])

  const handleUpload = async () => {
    if (files.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    // Upload in batches of 5
    const batchSize = 5
    const totalBatches = Math.ceil(files.length / batchSize)
    let completedBatches = 0

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const formData = new FormData()

      batch.forEach((f) => {
        formData.append("files", f.file)
      })

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx >= i && idx < i + batchSize
            ? { ...f, status: "uploading" }
            : f
        )
      )

      try {
        const response = await fetch(`/api/groups/${groupId}/images`, {
          method: "POST",
          body: formData,
        })

        const result = await response.json()

        if (response.ok) {
          // Update status to success
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx >= i && idx < i + batchSize
                ? { ...f, status: "success" }
                : f
            )
          )
        } else {
          // Update status to error
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx >= i && idx < i + batchSize
                ? { ...f, status: "error", error: result.error || "Upload failed" }
                : f
            )
          )
        }
      } catch (error) {
        // Update status to error
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx >= i && idx < i + batchSize
              ? { ...f, status: "error", error: "Network error" }
              : f
          )
        )
      }

      completedBatches++
      setUploadProgress(Math.round((completedBatches / totalBatches) * 100))
    }

    setIsUploading(false)
  }

  const successCount = files.filter((f) => f.status === "success").length
  const errorCount = files.filter((f) => f.status === "error").length
  const allDone = files.length > 0 && files.every((f) => f.status === "success" || f.status === "error")

  return (
    <div className="container py-8 max-w-4xl">
      <Link
        href={`/groups/${groupId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Group
      </Link>

      <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Images</h1>
      <p className="text-muted-foreground mb-8">
        Upload document images for OCR processing and analysis
      </p>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
        `}
      >
        <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">
          Drag and drop images here
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          or click to browse files
        </p>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <Button variant="secondary" className="pointer-events-none">
          Browse Files
        </Button>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {files.length} file{files.length !== 1 ? "s" : ""} selected
            </h2>
            {!isUploading && !allDone && (
              <Button onClick={() => setFiles([])}>
                Clear All
              </Button>
            )}
          </div>

          {/* Progress bar during upload */}
          {isUploading && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Summary after upload */}
          {allDone && (
            <div className="mb-4 p-4 rounded-lg bg-muted">
              <p className="font-medium">
                Upload complete: {successCount} succeeded, {errorCount} failed
              </p>
            </div>
          )}

          {/* File grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[400px] overflow-y-auto p-1">
            {files.map((f, index) => (
              <div
                key={index}
                className="relative aspect-square bg-muted rounded overflow-hidden group"
              >
                <img
                  src={f.preview}
                  alt={f.file.name}
                  className="w-full h-full object-cover"
                />

                {/* Status overlay */}
                {f.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  </div>
                )}
                {f.status === "success" && (
                  <div className="absolute inset-0 bg-green-500/50 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                )}
                {f.status === "error" && (
                  <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-white" />
                  </div>
                )}

                {/* Remove button */}
                {f.status === "pending" && (
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-6">
            {!allDone ? (
              <Button
                onClick={handleUpload}
                disabled={isUploading || files.length === 0}
                size="lg"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {files.length} Image{files.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={() => router.push(`/groups/${groupId}`)} size="lg">
                View Group
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
