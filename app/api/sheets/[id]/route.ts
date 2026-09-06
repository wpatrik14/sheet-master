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
  source: string | null
  musicalKey: string | null
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const db = getDb()
    const sheet = db
      .prepare(
        "SELECT id, title, filePath, fileSize, uploadDate, updatedAt, fileType, source, musicalKey FROM sheets WHERE id = ?"
      )
      .get(id) as Sheet | undefined
    
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const db = getDb()
    const sheet = db.prepare("SELECT id FROM sheets WHERE id = ?").get(id) as { id: string } | undefined

    if (!sheet) {
      return NextResponse.json(
        { error: "Sheet not found" },
        { status: 404 }
      )
    }

    const { title, source, musicalKey } = await request.json()

    const updates: string[] = []
    const values: (string | null)[] = []

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "Title must be a non-empty string" },
          { status: 400 }
        )
      }
      updates.push("title = ?")
      values.push(title.trim())
    }

    if (source !== undefined) {
      updates.push("source = ?")
      values.push(typeof source === "string" && source.trim().length > 0 ? source.trim() : null)
    }

    if (musicalKey !== undefined) {
      updates.push("musicalKey = ?")
      values.push(typeof musicalKey === "string" && musicalKey.trim().length > 0 ? musicalKey.trim() : null)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      )
    }

    updates.push("updatedAt = ?")
    values.push(new Date().toISOString())
    values.push(id)

    db.prepare(`UPDATE sheets SET ${updates.join(", ")} WHERE id = ?`).run(...values)

    const updatedSheet = db
      .prepare(
        "SELECT id, title, filePath, fileSize, uploadDate, updatedAt, fileType, source, musicalKey FROM sheets WHERE id = ?"
      )
      .get(id) as Sheet

    return NextResponse.json(updatedSheet)
  } catch (error) {
    console.error("Error updating sheet:", error)
    return NextResponse.json(
      { error: "Failed to update sheet" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const db = getDb()
    const sheet = db.prepare("SELECT id, filePath FROM sheets WHERE id = ?").get(id) as Sheet | undefined
    
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

    // Look this up before deleting the sheet row below: setlist_sheets has
    // ON DELETE CASCADE on sheetId, so once the sheet row is gone this
    // query would already come back empty and the reorder loop below would
    // silently never run, leaving gaps in the remaining sheets' positions.
    const setlistsContainingSheet = db.prepare("SELECT setlistId FROM setlist_sheets WHERE sheetId = ?").all(id) as { setlistId: string }[]

    // Delete sheet metadata from the database
    db.prepare("DELETE FROM sheets WHERE id = ?").run(id)

    // Remove this sheet from any setlists
    for (const { setlistId } of setlistsContainingSheet) {
      db.prepare("DELETE FROM setlist_sheets WHERE setlistId = ? AND sheetId = ?").run(setlistId, id)
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
