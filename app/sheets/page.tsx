 "use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Fuse from "fuse.js"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Eye, FileMusic, Pencil, Plus, Search, Trash, Upload } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { PDFViewer } from "@/components/pdf-viewer"
import { ImageViewer } from "@/components/image-viewer"
import { useToast } from "@/hooks/use-toast"

interface Sheet {
  id: string
  title: string
  filePath: string
  fileSize: number
  uploadDate: string
  fileType: string
  source: string | null
  musicalKey: string | null
  setlistCount: number
  currentSetlists: string[] // IDs of setlists this sheet is already in
  lastSungDate: string | null
  timesSungTotal: number
  timesSungRecent: number
}

type SortOption = "title" | "lastSung" | "mostSung"

// Strips accents so Hungarian searches match regardless of diacritics
// (e.g. "arad" finds "árad"), matching what users actually type on mobile.
function stripDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

export default function SheetsPage() {
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [sortBy, setSortBy] = useState<SortOption>("title")
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 24
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null)
  const [selectedSheetFile, setSelectedSheetFile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingSheet, setEditingSheet] = useState<Sheet | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editSource, setEditSource] = useState("")
  const [editMusicalKey, setEditMusicalKey] = useState("")
  const [isSavingEdit, setIsSavingEdit] = useState(false)
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

  const fetchSheets = useCallback(async () => {
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
  }, [toast])

  useEffect(() => {
    const successMessage = sessionStorage.getItem("sheetUploadSuccessMessage")
    if (successMessage) {
      toast({
        description: successMessage,
      })
      sessionStorage.removeItem("sheetUploadSuccessMessage")
    }

    fetchSheets()
  }, [fetchSheets, toast])

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

  const distinctSources = Array.from(
    new Set(sheets.map((sheet) => sheet.source).filter((source): source is string => !!source))
  ).sort((a, b) => a.localeCompare(b))

  // Accent-stripped copies so Fuse matches "arad" against "árad" etc.
  const searchableSheets = useMemo(
    () =>
      sheets.map((sheet) => ({
        sheet,
        searchTitle: stripDiacritics(sheet.title),
        searchSource: sheet.source ? stripDiacritics(sheet.source) : "",
      })),
    [sheets]
  )

  const fuse = useMemo(
    () =>
      new Fuse(searchableSheets, {
        keys: ["searchTitle", "searchSource"],
        threshold: 0.3,
        ignoreLocation: true,
      }),
    [searchableSheets]
  )

  const sourceFilteredSheets =
    sourceFilter === "all" ? sheets : sheets.filter((sheet) => sheet.source === sourceFilter)

  // Plain substring match first (what users expect for a partial title);
  // only fall back to Fuse's fuzzy matching when that finds nothing, so a
  // typo-tolerant search doesn't drown out exact results with loose ones.
  const matchedIds = (() => {
    const query = searchQuery.trim()
    if (!query) return null
    const normalizedQuery = stripDiacritics(query)
    const substringMatches = searchableSheets.filter(
      ({ searchTitle, searchSource }) => searchTitle.includes(normalizedQuery) || searchSource.includes(normalizedQuery)
    )
    if (substringMatches.length > 0) {
      return new Set(substringMatches.map(({ sheet }) => sheet.id))
    }
    return new Set(fuse.search(normalizedQuery).map((result) => result.item.sheet.id))
  })()

  const filteredSheets = sourceFilteredSheets
    .filter((sheet) => matchedIds === null || matchedIds.has(sheet.id))
    .sort((a, b) => {
      if (sortBy === "lastSung") {
        return (b.lastSungDate ?? "").localeCompare(a.lastSungDate ?? "")
      }
      if (sortBy === "mostSung") {
        return b.timesSungRecent - a.timesSungRecent
      }
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
    })

  const totalPages = Math.max(1, Math.ceil(filteredSheets.length / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pageSheets = filteredSheets.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE)

  const handlePreviewClick = (id: string) => {
    setSelectedSheetId(id)
    fetchSheetFile(id)
  }

  const openEditDialog = (sheet: Sheet) => {
    setEditingSheet(sheet)
    setEditTitle(sheet.title)
    setEditSource(sheet.source ?? "")
    setEditMusicalKey(sheet.musicalKey ?? "")
  }

  const saveEdit = async () => {
    if (!editingSheet) return
    if (editTitle.trim().length === 0) {
      toast({
        title: "Hiba",
        description: "A cím nem lehet üres",
        variant: "destructive",
      })
      return
    }

    setIsSavingEdit(true)
    try {
      const response = await fetch(`/api/sheets/${editingSheet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          source: editSource.trim(),
          musicalKey: editMusicalKey.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update sheet")
      }

      toast({ description: "Kotta frissítve" })
      setEditingSheet(null)
      fetchSheets()
    } catch (error) {
      console.error("Error updating sheet:", error)
      toast({
        title: "Error",
        description: "Nem sikerült frissíteni a kottát",
        variant: "destructive",
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Kottáim</h1>
        <Link href="/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Új kotta feltöltése
          </Button>
        </Link>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Kották keresése (cím vagy forrás)..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setCurrentPage(1)
          }}
        />
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
        <Select
          value={sourceFilter}
          onValueChange={(value) => {
            setSourceFilter(value)
            setCurrentPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Forrás" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes forrás</SelectItem>
            {distinctSources.map((source) => (
              <SelectItem key={source} value={source}>
                {source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(value) => {
            setSortBy(value as SortOption)
            setCurrentPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Rendezés" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="title">Cím szerint</SelectItem>
            <SelectItem value="lastSung">Legutóbb énekelve</SelectItem>
            <SelectItem value="mostSung">Leggyakrabban énekelve</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p>Kották betöltése...</p>
        </div>
      ) : filteredSheets.length === 0 ? (
        <div className="text-center py-12">
          <FileMusic className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2">Nem található kotta</h2>
          <p className="text-muted-foreground mb-4">
            {sheets.length === 0
              ? "Töltsd fel az első kottádat a kezdéshez"
              : "Nincs kotta ami megfelel a keresési feltételeknek"}
          </p>
          {sheets.length === 0 && (
            <Link href="/upload">
              <Button>Kotta feltöltése</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {pageSheets.map((sheet) => (
            <div key={sheet.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50">
              <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium truncate">{sheet.title}</span>
                {sheet.source && (
                  <Badge variant="secondary" className="shrink-0">
                    {sheet.source}
                  </Badge>
                )}
                {sheet.musicalKey && (
                  <Badge variant="outline" className="shrink-0">
                    {sheet.musicalKey}
                  </Badge>
                )}
                {sheet.setlistCount > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 hover:bg-blue-100 cursor-pointer shrink-0">
                        {sheet.setlistCount} dal-listában
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Dal-listák amelyek tartalmazzák: &quot;{sheet.title}&quot;</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-2 py-4">
                        {(Array.isArray(sheet.currentSetlists) ? sheet.currentSetlists : []).map(setlistId => {
                          const setlist = setlists.find(s => s.id === setlistId)
                          return setlist ? (
                            <div key={setlistId} className="flex items-center justify-between p-2 border rounded">
                              <span>{setlist.name}</span>
                              <Link href={`/setlists/${setlistId}`}>
                                <Button variant="ghost" size="sm">
                                  Megtekintés
                                </Button>
                              </Link>
                            </div>
                          ) : null
                        })}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Előnézet"
                      aria-label="Előnézet"
                      onClick={() => handlePreviewClick(sheet.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>{sheet.title}</DialogTitle>
                    </DialogHeader>
                    {selectedSheetId === sheet.id && selectedSheetFile && (
                      <div className="h-full overflow-auto">
                        {(sheet.fileType === 'application/pdf' || !sheet.fileType) ? (
                          <PDFViewer file={selectedSheetFile} />
                        ) : (
                          <ImageViewer file={selectedSheetFile} title={sheet.title} />
                        )}
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" title="Dal-listához adás" aria-label="Dal-listához adás">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Dal-listához adás</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="setlist" className="text-right">
                            Dal-lista
                          </label>
                          <select
                            id="setlist"
                            className="col-span-3 border rounded p-2"
                            onChange={(e) => setSelectedSetlist(e.target.value)}
                          >
                            <option value="">Válassz dal-listát</option>
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
                            } catch {
                              toast({
                                title: "Error",
                                description: "Failed to add sheet to setlist",
                                variant: "destructive",
                              })
                            }
                          }}
                        >
                          Hozzáadás
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                <Button
                  variant="ghost"
                  size="icon"
                  title="Szerkesztés"
                  aria-label="Szerkesztés"
                  onClick={() => openEditDialog(sheet)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Törlés"
                  aria-label="Törlés"
                  onClick={() => deleteSheet(sheet.id)}
                >
                  <Trash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage((p) => Math.max(1, p - 1))
                }}
                className={safeCurrentPage === 1 ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-4 text-sm text-muted-foreground whitespace-nowrap">
                {safeCurrentPage} / {totalPages} oldal
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }}
                className={safeCurrentPage === totalPages ? "pointer-events-none opacity-50" : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <Dialog open={editingSheet !== null} onOpenChange={(open) => !open && setEditingSheet(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Kotta szerkesztése</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Cím</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-source">Forrás (pl. &quot;Dicsérem Neved 2&quot;)</Label>
              <Input id="edit-source" value={editSource} onChange={(e) => setEditSource(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-key">Hangnem</Label>
              <Input id="edit-key" value={editMusicalKey} onChange={(e) => setEditMusicalKey(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveEdit} disabled={isSavingEdit}>
              {isSavingEdit ? "Mentés..." : "Mentés"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
