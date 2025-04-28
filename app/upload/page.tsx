"use client"

import type React from "react"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileUp, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function UploadPage() {
  const [title, setTitle] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)

    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]

      // Check if file is a PDF
      if (selectedFile.type !== "application/pdf") {
        setError("Only PDF files are supported")
        return
      }

      // Check file size (limit to 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit")
        return
      }

      setFile(selectedFile)

      // Create a preview URL
      const reader = new FileReader()
      reader.onload = (event) => {
        setFilePreview(event.target?.result as string)
      }
      reader.readAsDataURL(selectedFile)

      // Auto-fill title from filename if empty
      if (!title) {
        const fileName = selectedFile.name.replace(/\.[^/.]+$/, "") // Remove extension
        setTitle(fileName)
      }
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload")
      return
    }

    if (!title.trim()) {
      setError("Please enter a title for your sheet music")
      return
    }

    setIsUploading(true)

    try {
      // Read file as data URL
      const reader = new FileReader()

      reader.onload = async (event) => {
        const fileData = event.target?.result

        // Send to API
        const response = await fetch("/api/sheets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            file: fileData,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to upload sheet")
        }

        // Navigate to sheets page
        router.push("/sheets")
        router.refresh()
      }

      reader.readAsDataURL(file)
    } catch (err) {
      console.error("Error uploading file:", err)
      setError("Failed to upload file. Please try again.")
      setIsUploading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Upload Sheet Music</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter sheet music title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">PDF File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {filePreview ? (
                  <div>
                    <FileUp className="h-10 w-10 mx-auto mb-4 text-primary" />
                    <p className="font-medium">{file?.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(file?.size && (file.size / 1024 / 1024).toFixed(2)) || 0} MB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        setFile(null)
                        setFilePreview(null)
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ""
                        }
                      }}
                    >
                      Change file
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium">Drag and drop your PDF here</p>
                    <p className="text-sm text-muted-foreground mt-1">Or click to browse files</p>
                    <p className="text-xs text-muted-foreground mt-4">PDF files only, max 10MB</p>
                  </div>
                )}
              </div>
            </div>

            <Button className="w-full" onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? "Uploading..." : "Upload Sheet Music"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
