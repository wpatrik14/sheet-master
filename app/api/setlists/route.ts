import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { list, put, head } from '@vercel/blob'

export async function GET() {
  try {
    const { blobs } = await list({
      prefix: 'setlists/',
      limit: 100
    })

    const setlists = blobs.map(blob => ({
      id: blob.pathname.replace('setlists/', '').replace('.json', ''),
      name: blob.pathname.split('/').pop()?.replace('.json', '') || 'Untitled Setlist',
      createdAt: blob.uploadedAt.toISOString(),
      sheetCount: 0 // Will need to track this differently
    }))

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

    const blob = await put(`setlists/${id}.json`, JSON.stringify({
      name,
      createdAt,
      sheets: []
    }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    })

    return NextResponse.json({ 
      id,
      name,
      createdAt,
      sheetCount: 0,
      url: blob.url
    })
  } catch (error) {
    console.error("Error creating setlist:", error)
    return NextResponse.json({ error: "Failed to create setlist" }, { status: 500 })
  }
}
