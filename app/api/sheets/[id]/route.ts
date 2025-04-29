import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      )
    }

    const sheet = db
      .prepare("SELECT id, title, filePath as file FROM sheets WHERE id = ?")
      .get(id) as { id: string; title: string; file: string } | undefined

    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    // Construct proper file URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    let fileUrl = sheet.file
    
    if (!fileUrl.startsWith('http')) {
      // Extract just the filename if it's an absolute path
      const fileName = fileUrl.includes('\\') 
        ? fileUrl.split('\\').pop()
        : fileUrl.split('/').pop()
      fileUrl = `${baseUrl}/pdfs/${fileName}`
    }

    return NextResponse.json({
      id: sheet.id,
      title: sheet.title,
      file: fileUrl
    })
  } catch (error) {
    console.error("Error fetching sheet:", error)
    return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    if (!db) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      )
    }

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
