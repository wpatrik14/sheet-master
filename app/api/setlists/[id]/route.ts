import { NextResponse } from "next/server"
import { put, del } from '@vercel/blob'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const response = await fetch(`https://blob.vercel-storage.com/setlists/${id}.json`)
    
    if (!response.ok) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 })
    }

    const setlist = await response.json()
    return NextResponse.json({
      id,
      name: setlist.name,
      createdAt: setlist.createdAt,
      sheets: setlist.sheets || []
    })
  } catch (error) {
    console.error("Error fetching setlist:", error)
    return NextResponse.json({ error: "Failed to fetch setlist" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const { name, sheets } = await request.json()
    
    // Get current setlist
    const response = await fetch(`https://blob.vercel-storage.com/setlists/${id}.json`)
    if (!response.ok) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 })
    }
    const current = await response.json()

    // Update setlist
    await put(`setlists/${id}.json`, JSON.stringify({
      name: name || current.name,
      createdAt: current.createdAt,
      sheets: sheets || current.sheets || []
    }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating setlist:", error)
    return NextResponse.json({ error: "Failed to update setlist" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    const { sheetId } = await request.json()
    
    if (!sheetId) {
      return NextResponse.json({ error: "sheetId is required" }, { status: 400 })
    }

    // Get current setlist
    const response = await fetch(`https://blob.vercel-storage.com/setlists/${id}.json`)
    if (!response.ok) {
      return NextResponse.json({ error: "Setlist not found" }, { status: 404 })
    }
    const setlist = await response.json()

    // Check if sheet already exists
    if (setlist.sheets?.includes(sheetId)) {
      return NextResponse.json({ error: "Sheet already in setlist" }, { status: 400 })
    }

    // Update setlist with new sheet
    await put(`setlists/${id}.json`, JSON.stringify({
      ...setlist,
      sheets: [...(setlist.sheets || []), sheetId]
    }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding sheet to setlist:", error)
    return NextResponse.json({ error: "Failed to add sheet to setlist" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = await params
    try {
      await del(`setlists/${id}.json`)
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("Error deleting blob:", error)
      return NextResponse.json(
        { error: "Failed to delete setlist" },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error deleting setlist:", error)
    return NextResponse.json({ error: "Failed to delete setlist" }, { status: 500 })
  }
}
