"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { FileMusic, ArrowLeft, Save, Plus, Trash, MoveUp, MoveDown, Play } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

interface Sheet {
  id: string
  title: string
  position?: number
  file?: string
}

interface Setlist {
  id: string
  name: string
  createdAt: string
  sheets: Sheet[]
}

export default function EditSetlistPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const setlistId = params.id as string

  const [setlist, setSetlist] = useState<Setlist | null>(null)
  const [setlistName, setSetlistName] = useState("")
  const [sheets, setSheets] = useState<Sheet[]>([])
  const [availableSheets, setAvailableSheets] = useState<Sheet[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSetlistData()
  }, [setlistId])

  const fetchSetlistData = async () => {
    try {
      // Fetch setlist details
      const setlistResponse = await fetch(`/api/setlists/${setlistId}`)
      if (!setlistResponse.ok) {
        throw new Error("Failed to fetch setlist")
      }

      const setlistData = await setlistResponse.json()
      setSetlist(setlistData)
      setSetlistName(setlistData.name)
      setSheets(setlistData.sheets || [])

      // Fetch all sheets to determine available ones
      const sheetsResponse = await fetch("/api/sheets")
      if (!sheetsResponse.ok) {
        throw new Error("Failed to fetch sheets")
      }

      const allSheets = await sheetsResponse.json()

      // Filter out sheets already in the setlist
      const setlistSheetIds = new Set((setlistData.sheets || []).map((s: Sheet) => s.id))
      const availableSheets = allSheets.filter((s: Sheet) => !setlistSheetIds.has(s.id))

      setAvailableSheets(availableSheets)
    } catch (error) {
      console.error("Error fetching setlist data:", error)
      toast({
        title: "Error",
        description: "Failed to load setlist data. Please try again.",
        variant: "destructive",
      })
      router.push("/setlists")
    } finally {
      setIsLoading(false)
    }
  }

  const saveSetlist = async () => {
    if (!setlist || !setlistName.trim()) return

    try {
      const response = await fetch(`/api/setlists/${setlistId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: setlistName.trim(),
          sheets: sheets.map((sheet) => sheet.id),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update setlist")
      }

      toast({
        description: "Setlist saved successfully",
      })

      // Update local state
      setSetlist({
        ...setlist,
        name: setlistName.trim(),
      })
    } catch (error) {
      console.error("Error saving setlist:", error)
      toast({
        title: "Error",
        description: "Failed to save setlist. Please try again.",
        variant: "destructive",
      })
    }
  }

  const addSheetsToSetlist = async () => {
    if (!setlist || selectedSheets.length === 0) return

    try {
      // Get the selected sheets from available sheets
      const sheetsToAdd = availableSheets.filter((sheet) => selectedSheets.includes(sheet.id))

      // Add to current sheets with proper positions
      const updatedSheets = [...sheets, ...sheetsToAdd.map((sheet, i) => ({
        ...sheet,
        position: sheets.length + i
      }))]

      // Save to backend
      const response = await fetch(`/api/setlists/${setlistId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: setlistName.trim(),
          sheets: updatedSheets.map((sheet) => sheet.id),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update setlist")
      }

      // Update local state only after successful save
      setSheets(updatedSheets)

      // Remove from available sheets
      const updatedAvailableSheets = availableSheets.filter((sheet) => !selectedSheets.includes(sheet.id))
      setAvailableSheets(updatedAvailableSheets)

      // Clear selection
      setSelectedSheets([])
      
      // Force re-render to update perform button state
      setSetlist(prev => prev ? {...prev, sheets: updatedSheets} : null)

      toast({
        description: "Sheets added to setlist successfully",
      })
    } catch (error) {
      console.error("Error adding sheets to setlist:", error)
      toast({
        title: "Error",
        description: "Failed to add sheets to setlist. Please try again.",
        variant: "destructive",
      })
    }
  }

  const removeSheetFromSetlist = async (sheetId: string) => {
    if (!setlist) return

    // Find the sheet to remove
    const sheetToRemove = sheets.find((sheet) => sheet.id === sheetId)

    if (!sheetToRemove) return

    try {
      // Remove from current sheets
      const updatedSheets = sheets.filter((sheet) => sheet.id !== sheetId)

      // Save to backend
      const response = await fetch(`/api/setlists/${setlistId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: setlistName.trim(),
          sheets: updatedSheets.map((sheet) => sheet.id),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update setlist")
      }

      // Update local state only after successful save
      setSheets(updatedSheets)

      // Add to available sheets
      setAvailableSheets([...availableSheets, sheetToRemove])

      toast({
        description: "Sheet removed from setlist successfully",
      })
    } catch (error) {
      console.error("Error removing sheet from setlist:", error)
      toast({
        title: "Error",
        description: "Failed to remove sheet from setlist. Please try again.",
        variant: "destructive",
      })
    }
  }

  const moveSheetUp = async (index: number) => {
    if (index === 0 || !setlist) return

    try {
      const updatedSheets = [...sheets]
      const temp = updatedSheets[index]
      updatedSheets[index] = updatedSheets[index - 1]
      updatedSheets[index - 1] = temp

      // Save to backend
      const response = await fetch(`/api/setlists/${setlistId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: setlistName.trim(),
          sheets: updatedSheets.map((sheet) => sheet.id),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update setlist")
      }

      // Update local state only after successful save
      setSheets(updatedSheets)

      toast({
        description: "Sheet order updated successfully",
      })
    } catch (error) {
      console.error("Error updating sheet order:", error)
      toast({
        title: "Error",
        description: "Failed to update sheet order. Please try again.",
        variant: "destructive",
      })
    }
  }

  const moveSheetDown = async (index: number) => {
    if (index === sheets.length - 1 || !setlist) return

    try {
      const updatedSheets = [...sheets]
      const temp = updatedSheets[index]
      updatedSheets[index] = updatedSheets[index + 1]
      updatedSheets[index + 1] = temp

      // Save to backend
      const response = await fetch(`/api/setlists/${setlistId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: setlistName.trim(),
          sheets: updatedSheets.map((sheet) => sheet.id),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update setlist")
      }

      // Update local state only after successful save
      setSheets(updatedSheets)

      toast({
        description: "Sheet order updated successfully",
      })
    } catch (error) {
      console.error("Error updating sheet order:", error)
      toast({
        title: "Error",
        description: "Failed to update sheet order. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>
  }

  if (!setlist) {
    return <div className="container mx-auto px-4 py-8">Setlist not found</div>
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center mb-6">
        <Link href="/setlists">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Setlists
          </Button>
        </Link>
        <h1 className="text-3xl font-bold ml-4">Edit Setlist</h1>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="setlist-name">Setlist Name</Label>
              <Input
                id="setlist-name"
                value={setlistName}
                onChange={(e) => setSetlistName(e.target.value)}
                className="mt-2"
              />
            </div>
            <Button onClick={saveSetlist} disabled={!setlistName.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Sheets in this Setlist</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Sheets
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Sheets to Setlist</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {availableSheets.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No more sheets available to add</p>
              ) : (
                <ScrollArea className="h-[300px] pr-4">
                  {availableSheets.map((sheet) => (
                    <div key={sheet.id} className="flex items-center space-x-2 py-2">
                      <Checkbox
                        id={`sheet-${sheet.id}`}
                        checked={selectedSheets.includes(sheet.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSheets([...selectedSheets, sheet.id])
                          } else {
                            setSelectedSheets(selectedSheets.filter((id) => id !== sheet.id))
                          }
                        }}
                      />
                      <Label htmlFor={`sheet-${sheet.id}`} className="flex-1 cursor-pointer">
                        {sheet.title}
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button onClick={addSheetsToSetlist} disabled={selectedSheets.length === 0}>
                  Add Selected Sheets
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sheets.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <FileMusic className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No sheets in this setlist</h3>
          <p className="text-muted-foreground mb-4">Add sheets to create your performance setlist</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {sheets.map((sheet, index) => (
            <div key={sheet.id}>
              {index > 0 && <Separator />}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center">
                  <div className="font-medium mr-2 w-8 text-center text-muted-foreground">{index + 1}</div>
                  <FileMusic className="h-5 w-5 mr-3 text-muted-foreground" />
                  <span>{sheet.title}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveSheetUp(index)}>
                    <MoveUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={index === sheets.length - 1}
                    onClick={() => moveSheetDown(index)}
                  >
                    <MoveDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeSheetFromSetlist(sheet.id)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Link href={`/perform/${setlistId}`}>
          <Button disabled={sheets.length === 0}>
            <Play className="h-4 w-4 mr-2" />
            Enter Performance Mode
          </Button>
        </Link>
      </div>
    </div>
  )
}
