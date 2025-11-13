import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"

const UPLOAD_DIR = path.join(process.cwd(), "public", "sheets")

// Ensure the upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  fs.mkdir(UPLOAD_DIR, { recursive: true })
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
    const sheet = db.prepare("SELECT id, title, filePath, fileSize, uploadDate, updatedAt, fileType FROM sheets WHERE id = ?").get(params.id) as Sheet | undefined
    
    if (!sheet) {
      return NextResponse.json(
        { error: "Sheet not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...sheet,
      file: sheet.filePath
    })
  } catch (error) {
    console.error("Error fetching sheet:", error)
    return NextResponse.json(
      { error: "Failed to fetch sheet" },
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
    const sheet = db.prepare("SELECT id, filePath FROM sheets WHERE id = ?").get(params.id) as Sheet | undefined
    
    if (!sheet) {
      return NextResponse.json(
        { error: "Sheet not found" },
        { status: 404 }
      )
    }

    // Delete the actual file from the file system
    const absoluteFilePath = path.join(process.cwd(), "public", sheet.filePath)
    if (existsSync(absoluteFilePath)) {
      await fs.unlink(absoluteFilePath)
    }

    // Delete sheet metadata from the database
    db.prepare("DELETE FROM sheets WHERE id = ?").run(params.id)

    // Remove this sheet from any setlists
    const setlistsContainingSheet = db.prepare("SELECT setlistId FROM setlist_sheets WHERE sheetId = ?").all(params.id) as { setlistId: string }[]
    
    for (const { setlistId } of setlistsContainingSheet) {
      db.prepare("DELETE FROM setlist_sheets WHERE setlistId = ? AND sheetId = ?").run(setlistId, params.id)
      // Reorder remaining sheets in the setlist
      const remainingSheets = db.prepare("SELECT sheetId FROM setlist_sheets WHERE setlistId = ? ORDER BY position ASC").all(setlistId) as { sheetId: string }[]
      const updatePositionStmt = db.prepare("UPDATE setlist_sheets SET position = ? WHERE setlistId = ? AND sheetId = ?")
      db.transaction(() => {
        remainingSheets.forEach((s, index) => {
          updatePositionStmt.run(index, setlistId, s.sheetId)
        })
      })()
    }

    return NextResponse.json({ message: "Sheet deleted successfully" })
  } catch (error) {
    console.error("Error deleting sheet:", error)
    return NextResponse.json(
      { error: "Failed to delete sheet" },
      { status: 500 }
    )
  }
}
