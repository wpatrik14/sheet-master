import { NextResponse } from "next/server"
import { del, list, put } from '@vercel/blob'

const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) {
  throw new Error('BLOB_READ_WRITE_TOKEN is required')
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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sheet = await getSheetById(params.id)
    
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
  { params }: { params: { id: string } }
) {
  try {
    const sheet = await getSheetById(params.id)
    
    if (!sheet) {
      return NextResponse.json(
        { error: "Sheet not found" },
        { status: 404 }
      )
    }

    // Delete both the file and metadata
    const deletePromises = []
    
    // Delete file (could be PDF or image)
    // Check both pdfs/ and images/ folders
    const { blobs: pdfBlobs } = await list({
      prefix: `pdfs/${params.id}`,
      token
    })
    
    const { blobs: imageBlobs } = await list({
      prefix: `images/${params.id}`,
      token
    })
    
    // Delete PDF files
    for (const blob of pdfBlobs) {
      deletePromises.push(del(blob.url, { token }))
    }
    
    // Delete image files
    for (const blob of imageBlobs) {
      deletePromises.push(del(blob.url, { token }))
    }
    
    // Delete metadata file
    const { blobs: metadataBlobs } = await list({
      prefix: `sheets/${params.id}.json`,
      token
    })
    
    for (const blob of metadataBlobs) {
      deletePromises.push(del(blob.url, { token }))
    }
    
    await Promise.all(deletePromises)

    // Also need to remove this sheet from any setlists
    const { blobs: setlistBlobs } = await list({
      prefix: 'setlists/',
      token
    })
    
    for (const blob of setlistBlobs) {
      if (blob.pathname.endsWith('.json')) {
        try {
          const response = await fetch(blob.url)
          const setlist = await response.json()
          
          if (setlist.sheets && setlist.sheets.includes(params.id)) {
            // Remove sheet from setlist
            setlist.sheets = setlist.sheets.filter((sheetId: string) => sheetId !== params.id)
            
            // Update setlist
            await put(`setlists/${setlist.id}.json`, JSON.stringify(setlist), {
              access: 'public',
              contentType: 'application/json',
              addRandomSuffix: false,
              allowOverwrite: true,
              token
            })
          }
        } catch (error) {
          console.error(`Error updating setlist ${blob.pathname}:`, error)
        }
      }
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
