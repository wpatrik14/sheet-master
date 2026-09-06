"use client"

import type React from "react"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, FileUp, Upload } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)

    const selectedFiles = Array.from(e.target.files ?? [])

    if (selectedFiles.length === 0) {
      return
    }

    const invalidFile = selectedFiles.find((selectedFile) => selectedFile.type !== "application/pdf")
    if (invalidFile) {
      setError("Csak PDF fájlok támogatottak")
      e.target.value = ""
      return
    }

    const oversizedFile = selectedFiles.find((selectedFile) => selectedFile.size > 10 * 1024 * 1024)
    if (oversizedFile) {
      setError("A fájl mérete meghaladja a 10MB limitet")
      e.target.value = ""
      return
    }

    setFiles(selectedFiles)
  }

  const clearFiles = () => {
    setFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Kérlek válassz legalább egy PDF fájlt a feltöltéshez")
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append("files", file)
      })

      const response = await fetch("/api/sheets", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.details || "Failed to upload sheets")
      }

      sessionStorage.setItem(
        "sheetUploadSuccessMessage",
        `Sikeres feltöltés: ${files.length} PDF fájl${files.length === 1 ? "" : "ok"} feltöltve.`
      )
      window.location.href = "/sheets"
      router.refresh()
    } catch (err) {
      console.error("Error uploading files:", err)
      setError(err instanceof Error && err.message ? err.message : "Nem sikerült feltölteni a fájlokat. Kérlek próbáld újra.")
      setIsUploading(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Kották feltöltése</h1>

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
              <Label htmlFor="files">Kotta fájlok</Label>
              <div
                className="cursor-pointer rounded-lg border-2 border-dashed p-12 text-center transition-colors hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="files"
                  accept="application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />

                {files.length > 0 ? (
                  <div className="space-y-4">
                    <FileUp className="mx-auto mb-4 h-10 w-10 text-primary" />
                    <div className="space-y-2 text-left">
                      {files.map((file) => (
                        <div key={`${file.name}-${file.lastModified}`} className="rounded-md border bg-background px-3 py-2">
                          <p className="font-medium">{file.name.replace(/\.[^/.]+$/, "")}</p>
                          <p className="text-sm text-muted-foreground">
                            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        clearFiles()
                      }}
                    >
                      Fájlok cseréje
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                    <p className="font-medium">Húzd ide a kottáidat</p>
                    <p className="mt-1 text-sm text-muted-foreground">Vagy kattints a fájlok böngészéséhez</p>
                    <p className="mt-4 text-xs text-muted-foreground">PDF fájlok támogatottak, max 10MB / fájl</p>
                  </div>
                )}
              </div>
            </div>

            <Button className="w-full" onClick={handleUpload} disabled={isUploading || files.length === 0}>
              {isUploading ? "Feltöltés..." : "Kották feltöltése"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
