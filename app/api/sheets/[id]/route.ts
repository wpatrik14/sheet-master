import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const db = getDb()

    const sheet = db.prepare("SELECT * FROM sheets WHERE id = ?").get(id)

    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    return NextResponse.json(sheet)
  } catch (error) {
    console.error("Error fetching sheet:", error)
    return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    const db = getDb()

    // First delete from setlist_sheets
    db.prepare("DELETE FROM setlist_sheets WHERE sheetId = ?").run(id)

    // Then delete the sheet
    const result = db.prepare("DELETE FROM sheets WHERE id = ?").run(id)

    if (result.changes === 0) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting sheet:", error)
    return NextResponse.json({ error: "Failed to delete sheet" }, { status: 500 })
  }
}
