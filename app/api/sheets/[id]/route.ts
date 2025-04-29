import { NextResponse } from "next/server"
import { del } from '@vercel/blob'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const fileUrl = `https://blob.vercel-storage.com/${id}.pdf`

    return NextResponse.json({
      id,
      title: id, // Title will need to be stored differently
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
    try {
      await del(`https://blob.vercel-storage.com/${id}.pdf`)
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
