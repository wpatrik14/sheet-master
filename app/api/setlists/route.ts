import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { put, list } from '@vercel/blob'

const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) {
  throw new Error('BLOB_READ_WRITE_TOKEN is required')
}

interface Setlist {
  id: string
  name: string
  createdAt: string
  sheets: string[]
}

interface Sheet {
  id: string
  title: string
  filePath: string
  fileSize: number
  uploadDate: string
  updatedAt: string
}

async function getSetlists(): Promise<Setlist[]> {
  try {
    const { blobs } = await list({
      prefix: 'setlists/',
      token
    })
    
    const setlists: Setlist[] = []
    
    for (const blob of blobs) {
      if (blob.pathname.endsWith('.json')) {
        try {
          const response = await fetch(blob.url)
          const setlist = await response.json()
          setlists.push(setlist)
        } catch (error) {
          console.error(`Error fetching setlist metadata from ${blob.url}:`, error)
        }
      }
    }
    
    return setlists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch (error) {
    console.error("Error listing setlists:", error)
    return []
  }
}

async function getSheets(): Promise<Sheet[]> {
  try {
    const { blobs } = await list({
      prefix: 'sheets/',
      token
    })
    
    const sheets: Sheet[] = []
    
    for (const blob of blobs) {
      if (blob.pathname.endsWith('.json')) {
        try {
          const response = await fetch(blob.url)
          const sheet = await response.json()
          sheets.push(sheet)
        } catch (error) {
          console.error(`Error fetching sheet metadata from ${blob.url}:`, error)
        }
      }
    }
    
    return sheets
  } catch (error) {
    console.error("Error listing sheets:", error)
    return []
  }
}

export async function GET() {
  try {
    const [setlists, sheets] = await Promise.all([getSetlists(), getSheets()])
    
    // Add sheet count to each setlist
    const setlistsWithCounts = setlists.map(setlist => ({
      ...setlist,
      sheetCount: setlist.sheets ? setlist.sheets.length : 0
    }))

    return NextResponse.json({ setlists: setlistsWithCounts })
  } catch (error) {
    console.error("Error fetching setlists:", error)
      return NextResponse.json(
        { error: "Nem sikerült betölteni a dal-listákat" },
        { status: 500 }
      )
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json()

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Dal-lista név szükséges" },
        { status: 400 }
      )
    }

    const id = uuidv4()
    const createdAt = new Date().toISOString()

    const setlist: Setlist = {
      id,
      name: name.trim(),
      createdAt,
      sheets: []
    }

    // Save setlist metadata to blob storage
    await put(`setlists/${id}.json`, JSON.stringify(setlist), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      token
    })

    return NextResponse.json({
      ...setlist,
      sheetCount: 0
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült létrehozni a dal-listát" },
      { status: 500 }
    )
  }
}
