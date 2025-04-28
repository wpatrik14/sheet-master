import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const db = getDb()

    const setlist = db.prepare("SELECT * FROM setlists WHERE id = ?").get(id)

    if (!setlist) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 })
    }

    // Get sheets in this setlist with their order
    const sheets = db
      .prepare(`
      SELECT s.id, s.title, ss.position
      FROM sheets s
      JOIN setlist_sheets ss ON s.id = ss.sheetId
      WHERE ss.setlistId = ?
      ORDER BY ss.position
    `)
      .all(id)

    return NextResponse.json({ ...setlist, sheets })
  } catch (error) {
    console.error("Error fetching setlist:", error)
    return NextResponse.json({ error: "Failed to fetch setlist" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
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

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
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
