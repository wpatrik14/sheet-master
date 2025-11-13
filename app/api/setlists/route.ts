import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { getDb } from "@/lib/db"

interface Setlist {
  id: string
  name: string
  createdAt: string
  sheets: string[]
}

interface Sheet {
  id: string
  title: string
  filePath: string
  fileSize: number
  uploadDate: string
  updatedAt: string
}

export async function GET() {
  try {
    const db = getDb()
    const setlists = db.prepare("SELECT id, name, createdAt FROM setlists ORDER BY createdAt DESC").all() as Setlist[]
    
    const setlistsWithSheets = setlists.map(setlist => {
      const sheetsInSetlist = db.prepare("SELECT sheetId FROM setlist_sheets WHERE setlistId = ?").all(setlist.id) as { sheetId: string }[]
      return {
        ...setlist,
        sheets: sheetsInSetlist.map(s => s.sheetId),
        sheetCount: sheetsInSetlist.length
      }
    })

    return NextResponse.json({ setlists: setlistsWithSheets })
  } catch (error) {
    console.error("Error fetching setlists:", error)
      return NextResponse.json(
        { error: "Nem sikerült betölteni a dal-listákat" },
        { status: 500 }
      )
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json()

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Dal-lista név szükséges" },
        { status: 400 }
      )
    }

    const db = getDb()
    const id = uuidv4()
    const createdAt = new Date().toISOString()

    db.prepare("INSERT INTO setlists (id, name, createdAt) VALUES (?, ?, ?)").run(id, name.trim(), createdAt)

    return NextResponse.json({
      id,
      name: name.trim(),
      createdAt,
      sheets: [],
      sheetCount: 0
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült létrehozni a dal-listát" },
      { status: 500 }
    )
  }
}
