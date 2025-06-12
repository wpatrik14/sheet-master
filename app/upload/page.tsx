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

      // Check if file is a PDF or image
      const allowedTypes = [
        "application/pdf",
        "image/png", 
        "image/jpeg",
        "image/jpg"
      ]
      
      if (!allowedTypes.includes(selectedFile.type)) {
        setError("Csak PDF, PNG és JPG fájlok támogatottak")
        return
      }

      // Check file size (limit to 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("A fájl mérete meghaladja a 10MB limitet")
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
      setError("Kérlek válassz egy fájlt a feltöltéshez")
      return
    }

    if (!title.trim()) {
      setError("Kérlek add meg a kotta címét")
      return
    }

    setIsUploading(true)

    try {
      // Create FormData and append fields
      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('file', file)

      // Send to API
      const response = await fetch("/api/sheets", {
        method: "POST",
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.details || "Failed to upload sheet")
      }

      // Navigate to sheets page
      router.push("/sheets")
      router.refresh()
    } catch (err: any) {
      console.error("Error uploading file:", err)
      setError(err.message || "Nem sikerült feltölteni a fájlt. Kérlek próbáld újra.")
      setIsUploading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Kotta feltöltése</h1>

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
              <Label htmlFor="title">Cím</Label>
              <Input
                id="title"
                placeholder="Add meg a kotta címét"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Kotta fájl</Label>
              <div
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="file"
                  accept="application/pdf,image/png,image/jpeg,image/jpg"
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
                      Fájl cseréje
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium">Húzd ide a kottádat</p>
                    <p className="text-sm text-muted-foreground mt-1">Vagy kattints a fájlok böngészéséhez</p>
                    <p className="text-xs text-muted-foreground mt-4">PDF, PNG és JPG fájlok támogatottak, max 10MB</p>
                  </div>
                )}
              </div>
            </div>

            <Button className="w-full" onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? "Feltöltés..." : "Kotta feltöltése"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
