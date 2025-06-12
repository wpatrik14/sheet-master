"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PDFViewer } from "@/components/pdf-viewer"
import { ImageViewer } from "@/components/image-viewer"
import { ChevronLeft, ChevronRight, X, List, Maximize, Minimize } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut"

interface SheetMusic {
  id: string
  title: string
  file?: string
  position?: number
  fileType?: string
}

interface Setlist {
  id: string
  name: string
  createdAt: string
  sheets: SheetMusic[]
}

export default function PerformPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const setlistId = params.id as string

  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [sheets, setSheets] = useState<SheetMusic[]>([])
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentSheetFile, setCurrentSheetFile] = useState<string | null>(null)

  useEffect(() => {
    if (setlistId) {
      fetchSetlistData()
    }
  }, [setlistId])

  const fetchSetlistData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/setlists/${setlistId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch setlist")
      }

      const data = await response.json()
      if (!data) {
        throw new Error("Setlist not found")
      }

      setSetlist(data)
      setSheets(data.sheets || [])

      if (data.sheets?.length > 0) {
        fetchSheetFile(data.sheets[0].id)
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error fetching setlist:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load setlist",
        variant: "destructive",
      })
      router.push("/setlists")
    }
  }

  const fetchSheetFile = async (sheetId: string) => {
    try {
      const response = await fetch(`/api/sheets/${sheetId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch sheet")
      }

      const data = await response.json()
      setCurrentSheetFile(data.file)
      setIsLoading(false)
    } catch (error) {
      console.error("Error fetching sheet file:", error)
      toast({
        title: "Error",
        description: "Failed to load sheet file. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const goToNextSheet = () => {
    const nextIndex = currentSheetIndex + 1
    if (nextIndex < sheets.length) {
      setCurrentSheetIndex(nextIndex)
      fetchSheetFile(sheets[nextIndex].id)
      toast({
        description: `Now showing: ${sheets[nextIndex].title}`,
        duration: 2000,
      })
    }
  }

  const goToPreviousSheet = () => {
    const prevIndex = currentSheetIndex - 1
    if (prevIndex >= 0) {
      setCurrentSheetIndex(prevIndex)
      fetchSheetFile(sheets[prevIndex].id)
      toast({
        description: `Now showing: ${sheets[prevIndex].title}`,
        duration: 2000,
      })
    }
  }

  const goToSheet = (index: number) => {
    if (index >= 0 && index < sheets.length) {
      setCurrentSheetIndex(index)
      fetchSheetFile(sheets[index].id)
      toast({
        description: `Now showing: ${sheets[index].title}`,
        duration: 2000,
      })
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
      setIsFullscreen(true)
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  // Keyboard shortcuts
  useKeyboardShortcut("ArrowRight", goToNextSheet)
  useKeyboardShortcut("ArrowLeft", goToPreviousSheet)
  useKeyboardShortcut("f", toggleFullscreen)
  useKeyboardShortcut("Escape", () => {
    if (isFullscreen) {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  })

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Loading...</div>
  }

  if (!setlist || sheets.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <p className="mb-4">No sheets in this setlist</p>
        <Button onClick={() => router.push("/setlists")}>Back to Setlists</Button>
      </div>
    )
  }

  const currentSheet = sheets[currentSheetIndex]

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between p-2 border-b bg-background">
        <Button variant="ghost" size="sm" onClick={() => router.push("/setlists")}>
          <X className="h-4 w-4 mr-2" />
          Kilépés
        </Button>

        <div className="flex-1 text-center">
          <h1 className="font-medium truncate px-4">{setlist.name}</h1>
          <p className="text-sm text-muted-foreground">
            {currentSheetIndex + 1} of {sheets.length}: {currentSheet.title}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <List className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Setlist: {setlist.name}</SheetTitle>
              </SheetHeader>
              <div className="py-4">
                <div className="space-y-1">
                  {sheets.map((sheet, index) => (
                    <Button
                      key={sheet.id}
                      variant={index === currentSheetIndex ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => goToSheet(index)}
                    >
                      <span className="mr-2 w-6 text-center">{index + 1}</span>
                      <span className="truncate">{sheet.title}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* File Viewer */}
      <div className="flex-1 overflow-hidden">
        {currentSheetFile && (
          (currentSheet.fileType === 'application/pdf' || !currentSheet.fileType) ? (
            <PDFViewer file={currentSheetFile} />
          ) : (
            <ImageViewer file={currentSheetFile} title={currentSheet.title} />
          )
        )}
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between p-2 border-t bg-background">
        <Button variant="outline" onClick={goToPreviousSheet} disabled={currentSheetIndex === 0}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Előző
        </Button>

        <div className="text-sm text-muted-foreground">Use arrow keys to navigate • Press F for fullscreen</div>

        <Button variant="outline" onClick={goToNextSheet} disabled={currentSheetIndex === sheets.length - 1}>
          Következő
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
