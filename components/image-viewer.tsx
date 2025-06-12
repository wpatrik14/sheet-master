"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react"

interface ImageViewerProps {
  file: string
  title?: string
}

export function ImageViewer({ file, title }: ImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)

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

        {title && (
          <div className="text-sm font-medium">
            {title}
          </div>
        )}

        <div className="text-sm">
          {Math.round(scale * 100)}%
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center bg-muted/30">
        <div 
          className="transition-transform duration-200 ease-in-out"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center'
          }}
        >
          <img
            src={file}
            alt={title || "Sheet music"}
            className="max-w-full max-h-full object-contain shadow-lg"
            style={{
              maxWidth: '90vw',
              maxHeight: '80vh'
            }}
          />
        </div>
      </div>
    </div>
  )
}
