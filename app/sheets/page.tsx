 "use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Eye, FileMusic, Plus, Search, Trash, Upload } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PDFViewer } from "@/components/pdf-viewer"
import { useToast } from "@/hooks/use-toast"

interface Sheet {
  id: string
  title: string
  filePath: string
  fileSize: number
  uploadDate: string
  setlistCount: number
  currentSetlists: string[] // IDs of setlists this sheet is already in
}

export default function SheetsPage() {
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null)
  const [selectedSheetFile, setSelectedSheetFile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  interface Setlist {
    id: string
    name: string
  }
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [selectedSetlist, setSelectedSetlist] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchSetlists = async () => {
      try {
        const response = await fetch('/api/setlists')
        if (!response.ok) {
          throw new Error('Failed to fetch setlists')
        }
        const data = await response.json()
        // Ensure data is an array before setting state
        if (Array.isArray(data?.setlists)) {
          setSetlists(data.setlists)
        } else if (Array.isArray(data)) {
          setSetlists(data)
        } else {
          console.error('Invalid setlists data format:', data)
          setSetlists([])
        }
      } catch (error) {
        console.error('Error fetching setlists:', error)
      }
    }
    fetchSetlists()
  }, [])

  useEffect(() => {
    fetchSheets()
  }, [])

  const fetchSheets = async () => {
    try {
      const response = await fetch("/api/sheets")
      if (!response.ok) {
        throw new Error("Failed to fetch sheets")
      }

      const data = await response.json()
      setSheets(data || [])
    } catch (error) {
      console.error("Error fetching sheets:", error)
      toast({
        title: "Error",
        description: "Failed to load sheets. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSheetFile = async (id: string) => {
    try {
      const response = await fetch(`/api/sheets/${id}`)
      if (!response.ok) {
        throw new Error("Failed to fetch sheet")
      }

      const data = await response.json()
      setSelectedSheetFile(data.file)
    } catch (error) {
      console.error("Error fetching sheet file:", error)
      toast({
        title: "Error",
        description: "Failed to load sheet file. Please try again.",
        variant: "destructive",
      })
    }
  }

  const deleteSheet = async (id: string) => {
    try {
      const response = await fetch(`/api/sheets/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete sheet")
      }

      // Update the UI
      setSheets(sheets.filter((sheet) => sheet.id !== id))

      toast({
        description: "Sheet deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting sheet:", error)
      toast({
        title: "Error",
        description: "Failed to delete sheet. Please try again.",
        variant: "destructive",
      })
    }
  }

  const filteredSheets = sheets.filter((sheet) => sheet.title.toLowerCase().includes(searchQuery.toLowerCase()))

  const handlePreviewClick = (id: string) => {
    setSelectedSheetId(id)
    fetchSheetFile(id)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Sheet Music</h1>
        <Link href="/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload New Sheet
          </Button>
        </Link>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sheets..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p>Loading sheets...</p>
        </div>
      ) : filteredSheets.length === 0 ? (
        <div className="text-center py-12">
          <FileMusic className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2">No sheets found</h2>
          <p className="text-muted-foreground mb-4">
            {sheets.length === 0
              ? "Upload your first sheet music to get started"
              : "No sheets match your search criteria"}
          </p>
          {sheets.length === 0 && (
            <Link href="/upload">
              <Button>Upload Sheet Music</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSheets.map((sheet) => (
            <Card key={sheet.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <span className="truncate">{sheet.title}</span>
                  {sheet.setlistCount > 0 && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 ml-2 hover:bg-blue-100 cursor-pointer">
                          In {sheet.setlistCount} setlist{sheet.setlistCount !== 1 ? 's' : ''}
                        </button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Setlists containing "{sheet.title}"</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-2 py-4">
                          {(Array.isArray(sheet.currentSetlists) ? sheet.currentSetlists : []).map(setlistId => {
                            const setlist = setlists.find(s => s.id === setlistId)
                            return setlist ? (
                              <div key={setlistId} className="flex items-center justify-between p-2 border rounded">
                                <span>{setlist.name}</span>
                                <Link href={`/setlists/${setlistId}`}>
                                  <Button variant="ghost" size="sm">
                                    View
                                  </Button>
                                </Link>
                              </div>
                            ) : null
                          })}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-[3/4] bg-muted rounded flex items-center justify-center">
                  <FileMusic className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Uploaded on {new Date(sheet.uploadDate).toLocaleDateString()}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => handlePreviewClick(sheet.id)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>{sheet.title}</DialogTitle>
                    </DialogHeader>
                    {selectedSheetId === sheet.id && selectedSheetFile && (
                      <div className="h-full overflow-auto">
                        <PDFViewer file={selectedSheetFile} />
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Setlist
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Add to Setlist</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="setlist" className="text-right">
                            Setlist
                          </label>
                          <select
                            id="setlist"
                            className="col-span-3 border rounded p-2"
                            onChange={(e) => setSelectedSetlist(e.target.value)}
                          >
                            <option value="">Select a setlist</option>
                            {Array.isArray(setlists) && setlists
                              .filter(setlist => {
                                // Skip if sheet is already in this setlist
                                if (sheet.currentSetlists?.includes(setlist.id)) {
                                  return false
                                }
                                return true
                              })
                              .map((setlist) => (
                              <option key={setlist.id} value={setlist.id}>
                                {setlist.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={async () => {
                            if (!selectedSetlist) {
                              toast({
                                title: "Error",
                                description: "Please select a setlist",
                                variant: "destructive",
                              })
                              return
                            }
                            try {
                              const response = await fetch(`/api/setlists/${selectedSetlist}`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ sheetId: sheet.id }),
                              })
                              if (!response.ok) {
                                const errorData = await response.json()
                                if (response.status === 400 && errorData.error === "Sheet already in setlist") {
                                  toast({
                                    title: "Already Added",
                                    description: "This sheet is already in the selected setlist",
                                    variant: "destructive",
                                  })
                                } else {
                                  throw new Error("Failed to add sheet")
                                }
                              } else {
                                toast({
                                  description: "Sheet added to setlist successfully",
                                })
                                // Refresh the sheet data to update setlist counts
                                fetchSheets()
                              }
                            } catch (error) {
                              toast({
                                title: "Error",
                                description: "Failed to add sheet to setlist",
                                variant: "destructive",
                              })
                            }
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="destructive" size="sm" onClick={() => deleteSheet(sheet.id)}>
                    <Trash className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
