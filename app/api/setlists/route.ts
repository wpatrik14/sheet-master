import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { getDb } from "@/lib/db"

export async function GET() {
  try {
    const db = getDb()
    
    // Get setlists with sheet count
    const setlists = db.prepare(`
      SELECT 
        s.id,
        s.name,
        s.createdAt,
        COUNT(ss.sheetId) as sheetCount
      FROM setlists s
      LEFT JOIN setlist_sheets ss ON s.id = ss.setlistId
      GROUP BY s.id, s.name, s.createdAt
      ORDER BY s.createdAt DESC
    `).all()

    return NextResponse.json({ setlists })
  } catch (error) {
    console.error("Error fetching setlists:", error)
    return NextResponse.json({ error: "Failed to fetch setlists" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const id = uuidv4()
    const createdAt = new Date().toISOString()

    const db = getDb()
    const stmt = db.prepare("INSERT INTO setlists (id, name, createdAt) VALUES (?, ?, ?)")
    stmt.run(id, name, createdAt)

    return NextResponse.json({ 
      id,
      name,
      createdAt,
      sheetCount: 0
    })
  } catch (error) {
    console.error("Error creating setlist:", error)
    return NextResponse.json({ error: "Failed to create setlist" }, { status: 500 })
  }
}
