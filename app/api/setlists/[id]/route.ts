import { NextResponse } from "next/server"
import { put, list, del } from '@vercel/blob'

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
  fileType: string
}

async function getSetlistById(id: string): Promise<Setlist | null> {
  try {
    const { blobs } = await list({
      prefix: `setlists/${id}.json`,
      token
    })
    
    if (blobs.length === 0) {
      return null
    }
    
    const response = await fetch(blobs[0].url)
    const setlist = await response.json()
    return setlist
  } catch (error) {
    console.error(`Error fetching setlist ${id}:`, error)
    return null
  }
}

async function getSheetById(id: string): Promise<Sheet | null> {
  try {
    const { blobs } = await list({
      prefix: `sheets/${id}.json`,
      token
    })
    
    if (blobs.length === 0) {
      return null
    }
    
    const response = await fetch(blobs[0].url)
    const sheet = await response.json()
    return sheet
  } catch (error) {
    console.error(`Error fetching sheet ${id}:`, error)
    return null
  }
}

async function updateSetlist(setlist: Setlist): Promise<void> {
  await put(`setlists/${setlist.id}.json`, JSON.stringify(setlist), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    token
  })
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const setlist = await getSetlistById(params.id)
    
    if (!setlist) {
      return NextResponse.json(
        { error: "Dal-lista nem található" },
        { status: 404 }
      )
    }

    // Get sheet details for each sheet in the setlist
    const sheetDetails = []
    for (const sheetId of setlist.sheets) {
      const sheet = await getSheetById(sheetId)
      if (sheet) {
        sheetDetails.push({
          id: sheet.id,
          title: sheet.title,
          filePath: sheet.filePath,
          fileType: sheet.fileType,
          position: setlist.sheets.indexOf(sheetId)
        })
      }
    }

    return NextResponse.json({
      ...setlist,
      sheets: sheetDetails
    })
  } catch (error) {
    console.error("Error fetching setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült betölteni a dal-listát" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const setlist = await getSetlistById(params.id)
    
    if (!setlist) {
      return NextResponse.json(
        { error: "Dal-lista nem található" },
        { status: 404 }
      )
    }

    const { name, sheets } = await request.json()

    if (name !== undefined) {
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Dal-lista név szükséges" },
          { status: 400 }
        )
      }
      setlist.name = name.trim()
    }

    if (sheets !== undefined) {
      if (!Array.isArray(sheets)) {
        return NextResponse.json(
          { error: "A kották listája tömb kell legyen" },
          { status: 400 }
        )
      }
      setlist.sheets = sheets
    }

    await updateSetlist(setlist)

    return NextResponse.json(setlist)
  } catch (error) {
    console.error("Error updating setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült frissíteni a dal-listát" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const setlist = await getSetlistById(params.id)
    
    if (!setlist) {
      return NextResponse.json(
        { error: "Dal-lista nem található" },
        { status: 404 }
      )
    }

    const { sheetId } = await request.json()

    if (!sheetId || typeof sheetId !== "string") {
      return NextResponse.json(
        { error: "Kotta azonosító szükséges" },
        { status: 400 }
      )
    }

    // Check if sheet exists
    const sheet = await getSheetById(sheetId)
    if (!sheet) {
      return NextResponse.json(
        { error: "Kotta nem található" },
        { status: 404 }
      )
    }

    // Check if sheet is already in setlist
    if (setlist.sheets.includes(sheetId)) {
      return NextResponse.json(
        { error: "A kotta már benne van a dal-listában" },
        { status: 400 }
      )
    }

    // Add sheet to setlist
    setlist.sheets.push(sheetId)
    await updateSetlist(setlist)

    return NextResponse.json({ message: "Kotta sikeresen hozzáadva a dal-listához" })
  } catch (error) {
    console.error("Error adding sheet to setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült hozzáadni a kottát a dal-listához" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const setlist = await getSetlistById(params.id)
    
    if (!setlist) {
      return NextResponse.json(
        { error: "Dal-lista nem található" },
        { status: 404 }
      )
    }

    // Delete setlist metadata file
    const { blobs } = await list({
      prefix: `setlists/${params.id}.json`,
      token
    })
    
    for (const blob of blobs) {
      await del(blob.url, { token })
    }

    return NextResponse.json({ message: "Dal-lista sikeresen törölve" })
  } catch (error) {
    console.error("Error deleting setlist:", error)
    return NextResponse.json(
      { error: "Nem sikerült törölni a dal-listát" },
      { status: 500 }
    )
  }
}
