import { NextResponse } from "next/server"
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
  fileType: string
}

export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { params } = context
    const db = getDb()
    const setlist = db.prepare("SELECT id, name, createdAt FROM setlists WHERE id = ?").get(params.id) as Setlist | undefined

    if (!setlist) {
      return NextResponse.json(
        { error: "Dal-lista nem található" },
        { status: 404 }
      )
    }

    const sheetsInSetlist = db.prepare("SELECT sheetId, position FROM setlist_sheets WHERE setlistId = ? ORDER BY position ASC").all(params.id) as { sheetId: string, position: number }[]
    
    const sheetDetails = []
    for (const s of sheetsInSetlist) {
      const sheet = db.prepare("SELECT id, title, filePath, fileType FROM sheets WHERE id = ?").get(s.sheetId) as Sheet | undefined
      if (sheet) {
        sheetDetails.push({
          id: sheet.id,
          title: sheet.title,
          filePath: sheet.filePath,
          fileType: sheet.fileType,
          position: s.position
        })
      }
    }

    return NextResponse.json({
      ...setlist,
      sheets: sheetDetails
    })
  } catch (error) {
    console.error("Error fetching setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült betölteni a dal-listát" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { params } = context
    const db = getDb()
    const setlist = db.prepare("SELECT id, name, createdAt FROM setlists WHERE id = ?").get(params.id) as Setlist | undefined

    if (!setlist) {
      return NextResponse.json(
        { error: "Dal-lista nem található" },
        { status: 404 }
      )
    }

    const { name, sheets } = await request.json()

    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Dal-lista név szükséges" },
          { status: 400 }
        )
      }
      db.prepare("UPDATE setlists SET name = ? WHERE id = ?").run(name.trim(), params.id)
      setlist.name = name.trim()
    }

    if (sheets !== undefined) {
      if (!Array.isArray(sheets)) {
        return NextResponse.json(
          { error: "A kották listája tömb kell legyen" },
          { status: 400 }
        )
      }
      
      // Clear existing sheets for this setlist
      db.prepare("DELETE FROM setlist_sheets WHERE setlistId = ?").run(params.id)

      // Insert new sheets
      const insertSheetStmt = db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)")
      const insertTransaction = db.transaction((sheetIds: string[]) => {
        sheetIds.forEach((sheetId, index) => {
          insertSheetStmt.run(params.id, sheetId, index)
        })
      })
      insertTransaction(sheets)
    }

    return NextResponse.json(setlist)
  } catch (error) {
    console.error("Error updating setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült frissíteni a dal-listát" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { params } = context
    const db = getDb()
    const setlist = db.prepare("SELECT id FROM setlists WHERE id = ?").get(params.id) as { id: string } | undefined
    
    if (!setlist) {
      return NextResponse.json(
        { error: "Dal-lista nem található" },
        { status: 404 }
      )
    }

    const { sheetId } = await request.json()

    if (!sheetId || typeof sheetId !== "string") {
      return NextResponse.json(
        { error: "Kotta azonosító szükséges" },
        { status: 400 }
      )
    }

    // Check if sheet exists
    const sheet = db.prepare("SELECT id FROM sheets WHERE id = ?").get(sheetId) as { id: string } | undefined
    if (!sheet) {
      return NextResponse.json(
        { error: "Kotta nem található" },
        { status: 404 }
      )
    }

    // Check if sheet is already in setlist
    const existingEntry = db.prepare("SELECT 1 FROM setlist_sheets WHERE setlistId = ? AND sheetId = ?").get(params.id, sheetId)
    if (existingEntry) {
      return NextResponse.json(
        { error: "A kotta már benne van a dal-listában" },
        { status: 400 }
      )
    }

    // Add sheet to setlist
    const currentMaxPosition = db.prepare("SELECT MAX(position) as maxPosition FROM setlist_sheets WHERE setlistId = ?").get(params.id) as { maxPosition: number | null }
    const newPosition = (currentMaxPosition.maxPosition ?? -1) + 1
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run(params.id, sheetId, newPosition)

    return NextResponse.json({ message: "Kotta sikeresen hozzáadva a dal-listához" })
  } catch (error) {
    console.error("Error adding sheet to setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült hozzáadni a kottát a dal-listához" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { params } = context
    const db = getDb()
    const setlist = db.prepare("SELECT id FROM setlists WHERE id = ?").get(params.id) as { id: string } | undefined
    
    if (!setlist) {
      return NextResponse.json(
        { error: "Dal-lista nem található" },
        { status: 404 }
      )
    }

    // Delete setlist and its associated sheets
    db.prepare("DELETE FROM setlists WHERE id = ?").run(params.id)
    // setlist_sheets will be deleted by ON DELETE CASCADE

    return NextResponse.json({ message: "Dal-lista sikeresen törölve" })
  } catch (error) {
    console.error("Error deleting setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült törölni a dal-listát" },
      { status: 500 }
    )
  }
}
