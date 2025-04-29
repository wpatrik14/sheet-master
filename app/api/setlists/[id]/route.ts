import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const db = getDb()

    const setlist = db.prepare("SELECT * FROM setlists WHERE id = ?").get(id)

    if (!setlist) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 })
    }

    // Get sheets in this setlist with their order
    const sheets = db
      .prepare(`
      SELECT s.id, s.title, s.filePath as file, ss.position
      FROM sheets s
      JOIN setlist_sheets ss ON s.id = ss.sheetId
      WHERE ss.setlistId = ?
      ORDER BY ss.position
    `)
      .all(id) as Array<{
        id: string
        title: string
        file: string
        position: number
      }>

    return NextResponse.json({
      ...setlist,
      sheets: sheets.map(sheet => ({
        id: sheet.id,
        title: sheet.title,
        file: sheet.file,
        position: sheet.position
      }))
    })
  } catch (error) {
    console.error("Error fetching setlist:", error)
    return NextResponse.json({ error: "Failed to fetch setlist" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const { name, sheets } = await request.json()

    const db = getDb()

    // Start a transaction
    db.exec("BEGIN TRANSACTION")

    try {
      // Update setlist name
      if (name) {
        db.prepare("UPDATE setlists SET name = ? WHERE id = ?").run(name, id)
      }

      // Update sheets if provided
      if (sheets && Array.isArray(sheets)) {
        // Delete existing sheet associations
        db.prepare("DELETE FROM setlist_sheets WHERE setlistId = ?").run(id)

        // Insert new sheet associations with positions
        const insertStmt = db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)")

        sheets.forEach((sheetId, index) => {
          insertStmt.run(id, sheetId, index)
        })
      }

      db.exec("COMMIT")
      return NextResponse.json({ success: true })
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }
  } catch (error) {
    console.error("Error updating setlist:", error)
    return NextResponse.json({ error: "Failed to update setlist" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const { sheetId } = await request.json()
    
    if (!sheetId) {
      return NextResponse.json({ error: "sheetId is required" }, { status: 400 })
    }

    const db = getDb()

    // Check if setlist exists
    const setlist = db.prepare("SELECT id FROM setlists WHERE id = ?").get(id)
    if (!setlist) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 })
    }

    // Check if sheet exists
    const sheet = db.prepare("SELECT id FROM sheets WHERE id = ?").get(sheetId)
    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    // Check if sheet is already in setlist
    const existing = db
      .prepare("SELECT * FROM setlist_sheets WHERE setlistId = ? AND sheetId = ?")
      .get(id, sheetId)
    
    if (existing) {
      return NextResponse.json({ error: "Sheet already in setlist" }, { status: 400 })
    }

    // Get current max position
    interface MaxPosResult {
      maxPos: number | null
    }
    const maxPosResult = db
      .prepare("SELECT MAX(position) as maxPos FROM setlist_sheets WHERE setlistId = ?")
      .get(id) as MaxPosResult
    const maxPos = maxPosResult.maxPos || 0

    // Add sheet to setlist
    db
      .prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)")
      .run(id, sheetId, maxPos + 1)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding sheet to setlist:", error)
    return NextResponse.json({ error: "Failed to add sheet to setlist" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const db = getDb()

    // First delete from setlist_sheets
    db.prepare("DELETE FROM setlist_sheets WHERE setlistId = ?").run(id)

    // Then delete the setlist
    const result = db.prepare("DELETE FROM setlists WHERE id = ?").run(id)

    if (result.changes === 0) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting setlist:", error)
    return NextResponse.json({ error: "Failed to delete setlist" }, { status: 500 })
  }
}
