"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

interface PDFViewerProps {
  file: string
}

export function PDFViewer({ file }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadWorker = async () => {
      try {
        // First try local worker for mobile
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
          const response = await fetch('/pdf.worker.min.mjs')
          if (response.ok) {
            pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
            return
          }
        }
        // Fallback to CDN
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`
      } catch (error) {
        console.error('Error loading PDF worker:', error)
        // Final fallback to CDN
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs`
      }
    }
    loadWorker()
  }, [])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    setIsLoading(false)
  }

  const zoomIn = () => {
    setScale(scale + 0.2)
  }

  const zoomOut = () => {
    if (scale > 0.4) {
      setScale(scale - 0.2)
    }
  }

  const rotate = () => {
    setRotation((rotation + 90) % 360)
  }

  const goToNextPage = () => {
    try {
      setIsLoading(true)
      if (pageNumber < (numPages || 0)) {
        setPageNumber(pageNumber + 1)
      }
    } catch (error) {
      console.error('Navigation error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const goToPrevPage = () => {
    try {
      setIsLoading(true)
      if (pageNumber > 1) {
        setPageNumber(pageNumber - 1)
      }
    } catch (error) {
      console.error('Navigation error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Reset page number when file changes
  useEffect(() => {
    setPageNumber(1)
    setNumPages(null)
    setIsLoading(true)
  }, [file])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={rotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        {numPages && (
          <div className="text-sm">
            Page {pageNumber} of {numPages}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={goToPrevPage} disabled={pageNumber <= 1}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextPage} disabled={pageNumber >= (numPages || 0)}>
            Next
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/30">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8">
            <Skeleton className="h-[400px] w-[300px] mb-4" />
            <Skeleton className="h-4 w-[250px]" />
          </div>
        )}

        <Document
          file={useMemo(() => file.startsWith('http') ? { url: file } : file, [file])}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={null}
          className="max-h-full"
          onError={(error) => {
            console.error("PDF Loading Error:", {
              error: error.toString(),
              fileUrl: file,
              timestamp: new Date().toISOString()
            })
            setIsLoading(false)
          }}
          noData={<div className="p-4 text-center">Unable to load PDF. The file may be corrupted or invalid.</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            rotate={rotation}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-lg"
          width={Math.min(window.innerWidth - 40, window.innerWidth > 768 ? 800 : window.innerWidth - 20)}
          />
        </Document>
      </div>
    </div>
  )
}
