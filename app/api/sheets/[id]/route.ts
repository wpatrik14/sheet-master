import { NextResponse } from "next/server"
import { del } from '@vercel/blob'
import { getDb } from "@/lib/db"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const db = getDb()
    
    // Get sheet from database
    const sheet = db.prepare("SELECT * FROM sheets WHERE id = ?").get(id) as {
      id: string
      title: string
      filePath: string
      fileSize: number
      uploadDate: string
      updatedAt: string
    } | undefined

    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: sheet.id,
      title: sheet.title,
      file: sheet.filePath,
      fileSize: sheet.fileSize,
      uploadDate: sheet.uploadDate,
      updatedAt: sheet.updatedAt
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
    
    // Get sheet info before deleting
    const sheet = db.prepare("SELECT filePath FROM sheets WHERE id = ?").get(id) as { filePath: string } | undefined
    
    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    try {
      // Delete from blob storage
      await del(sheet.filePath)
      
      // Delete from database (this will also cascade delete from setlist_sheets)
      db.prepare("DELETE FROM sheets WHERE id = ?").run(id)
      
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Error deleting blob:", error)
      return NextResponse.json(
        { error: "Failed to delete sheet" }, 
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error deleting sheet:", error)
    return NextResponse.json({ error: "Failed to delete sheet" }, { status: 500 })
  }
}
