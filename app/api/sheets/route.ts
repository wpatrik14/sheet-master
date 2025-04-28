import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"

export async function GET() {
  try {
    const db = getDb()
    const sheets = db.prepare("SELECT id, title, uploadDate FROM sheets ORDER BY uploadDate DESC").all()

    return NextResponse.json({ sheets })
  } catch (error) {
    console.error("Error fetching sheets:", error)
    return NextResponse.json({ error: "Failed to fetch sheets" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { title, file } = await request.json()

    if (!title || !file) {
      return NextResponse.json({ error: "Title and file are required" }, { status: 400 })
    }

    const id = uuidv4()
    const uploadDate = new Date().toISOString()

    const db = getDb()
    db.prepare("INSERT INTO sheets (id, title, file, uploadDate) VALUES (?, ?, ?, ?)").run(id, title, file, uploadDate)

    return NextResponse.json({ id, title, uploadDate })
  } catch (error) {
    console.error("Error creating sheet:", error)
    return NextResponse.json({ error: "Failed to create sheet" }, { status: 500 })
  }
}
