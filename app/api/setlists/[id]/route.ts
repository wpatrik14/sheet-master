import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const db = getDb()
    
    // Get setlist with its sheets
    const setlist = db.prepare(`
      SELECT id, name, createdAt FROM setlists WHERE id = ?
    `).get(id)
    
    if (!setlist) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 })
    }

    // Get sheets in this setlist with their details
    const sheets = db.prepare(`
      SELECT 
        s.id,
        s.title,
        s.filePath,
        ss.position
      FROM setlist_sheets ss
      JOIN sheets s ON ss.sheetId = s.id
      WHERE ss.setlistId = ?
      ORDER BY ss.position
    `).all(id)

    return NextResponse.json({
      ...setlist,
      sheets: sheets || []
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
    
    // Check if setlist exists
    const setlist = db.prepare("SELECT id FROM setlists WHERE id = ?").get(id)
    if (!setlist) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 })
    }

    // Update setlist name if provided
    if (name) {
      db.prepare("UPDATE setlists SET name = ? WHERE id = ?").run(name, id)
    }

    // Update sheets if provided
    if (sheets && Array.isArray(sheets)) {
      // Remove existing sheets from setlist
      db.prepare("DELETE FROM setlist_sheets WHERE setlistId = ?").run(id)
      
      // Add new sheets with positions
      const insertStmt = db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)")
      sheets.forEach((sheetId: string, index: number) => {
        insertStmt.run(id, sheetId, index)
      })
    }

    return NextResponse.json({ success: true })
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

    // Check if sheet already in setlist
    const existing = db.prepare("SELECT setlistId FROM setlist_sheets WHERE setlistId = ? AND sheetId = ?").get(id, sheetId)
    if (existing) {
      return NextResponse.json({ error: "Sheet already in setlist" }, { status: 400 })
    }

    // Get next position
    const maxPosition = db.prepare("SELECT MAX(position) as maxPos FROM setlist_sheets WHERE setlistId = ?").get(id) as { maxPos: number | null }
    const nextPosition = (maxPosition?.maxPos || -1) + 1

    // Add sheet to setlist
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run(id, sheetId, nextPosition)

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
    
    // Delete setlist (cascade will handle setlist_sheets)
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
