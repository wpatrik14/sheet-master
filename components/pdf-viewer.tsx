"use client"

import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

// Use a specific version that's known to be available and stable
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`

interface PDFViewerProps {
  file: string
}

export function PDFViewer({ file }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

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
    if (pageNumber < (numPages || 0)) {
      setPageNumber(pageNumber + 1)
    }
  }

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      setPageNumber(pageNumber - 1)
    }
  }

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
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={null}
          className="max-h-full"
          onError={(error) => {
            console.error("Error loading PDF:", error)
            setIsLoading(false)
          }}
          noData={<div className="p-4 text-center">Unable to load PDF. Please try again.</div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            rotate={rotation}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-lg"
          />
        </Document>
      </div>
    </div>
  )
}
