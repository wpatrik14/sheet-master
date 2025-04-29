"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ListMusic, Play } from "lucide-react"

export default function PerformPage() {
  const [setlists, setSetlists] = useState<Array<{ id: string; name: string; sheetCount: number; createdAt: string }>>([])
  const router = useRouter()

  useEffect(() => {
    const fetchSetlists = async () => {
      try {
        const response = await fetch('/api/setlists')
        if (!response.ok) {
          throw new Error('Failed to fetch setlists')
        }
        const { setlists } = await response.json()
        // Only show setlists with sheets
        const setlistsWithSheets = setlists.filter((setlist: { sheetCount: number }) => setlist.sheetCount > 0)
        setSetlists(setlistsWithSheets)
      } catch (error) {
        console.error('Error fetching setlists:', error)
      }
    }
    fetchSetlists()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Performance Mode</h1>

      {setlists.length === 0 ? (
        <div className="text-center py-12">
          <ListMusic className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-medium mb-2">No setlists available</h2>
          <p className="text-muted-foreground mb-4">Create a setlist with sheet music to enter performance mode</p>
          <Button onClick={() => router.push("/setlists")}>Go to Setlists</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {setlists.map((setlist) => (
            <Card
              key={setlist.id}
              className="hover:border-primary transition-colors cursor-pointer"
              onClick={() => router.push(`/perform/${setlist.id}`)}
            >
              <CardHeader>
                <CardTitle>{setlist.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {setlist.sheetCount} {setlist.sheetCount === 1 ? "sheet" : "sheets"}
                </p>
                <Button className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Perform This Setlist
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
