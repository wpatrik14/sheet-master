"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ListMusic, Plus, Edit, Trash, Play } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Setlist {
  id: string
  name: string
  createdAt: string
  sheetCount: number
}

export default function SetlistsPage() {
  const [setlists, setSetlists] = useState<Setlist[]>([])
  const [newSetlistName, setNewSetlistName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetchSetlists()
  }, [])

  const fetchSetlists = async () => {
    try {
      const response = await fetch("/api/setlists")
      if (!response.ok) {
        throw new Error("Failed to fetch setlists")
      }

      const data = await response.json()
      setSetlists(data.setlists || [])
    } catch (error) {
      console.error("Error fetching setlists:", error)
      toast({
        title: "Hiba",
        description: "Nem sikerült betölteni a dal-listákat. Kérlek próbáld újra.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createSetlist = async () => {
    if (!newSetlistName.trim()) return

    try {
      const response = await fetch("/api/setlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newSetlistName.trim(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create setlist")
      }

      const newSetlist = await response.json()
      setSetlists([{ ...newSetlist, sheetCount: 0 }, ...setlists])
      setNewSetlistName("")

      toast({
        description: "Dal-lista sikeresen létrehozva",
      })
    } catch (error) {
      console.error("Error creating setlist:", error)
      toast({
        title: "Hiba",
        description: "Nem sikerült létrehozni a dal-listát. Kérlek próbáld újra.",
        variant: "destructive",
      })
    }
  }

  const deleteSetlist = async (id: string) => {
    try {
      const response = await fetch(`/api/setlists/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete setlist")
      }

      // Update the UI
      setSetlists(setlists.filter((setlist) => setlist.id !== id))

      toast({
        description: "Dal-lista sikeresen törölve",
      })
    } catch (error) {
      console.error("Error deleting setlist:", error)
      toast({
        title: "Hiba",
        description: "Nem sikerült törölni a dal-listát. Kérlek próbáld újra.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Dal-listáim</h1>

      <Dialog>
        <DialogTrigger asChild>
          <Button className="mb-6">
            <Plus className="mr-2 h-4 w-4" />
            Új dal-lista létrehozása
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új dal-lista létrehozása</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="setlist-name">Dal-lista neve</Label>
            <Input
              id="setlist-name"
              value={newSetlistName}
              onChange={(e) => setNewSetlistName(e.target.value)}
              placeholder="Add meg a dal-lista nevét"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Mégse</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={createSetlist} disabled={!newSetlistName.trim()}>
                Dal-lista létrehozása
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="text-center py-12">
          <p>Dal-listák betöltése...</p>
        </div>
      ) : setlists.length === 0 ? (
        <div className="text-center py-12">
          <ListMusic className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2">Még nincsenek dal-listák</h2>
          <p className="text-muted-foreground mb-4">
            Hozd létre az első dal-listádat a kottáid rendezéséhez az előadásokhoz
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {setlists.map((setlist) => (
            <Card key={setlist.id}>
              <CardHeader>
                <CardTitle>{setlist.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {setlist.sheetCount} kotta
                </p>
                <p className="text-sm text-muted-foreground">
                  Létrehozva: {new Date(setlist.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="flex space-x-2">
                  <Link href={`/setlists/${setlist.id}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Szerkesztés
                    </Button>
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => deleteSetlist(setlist.id)}>
                    <Trash className="h-4 w-4 mr-2" />
                    Törlés
                  </Button>
                </div>
                <Link href={`/perform/${setlist.id}`}>
                  <Button size="sm" disabled={setlist.sheetCount === 0}>
                    <Play className="h-4 w-4 mr-2" />
                    Előadás
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
