import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { put, list } from '@vercel/blob'

export async function GET() {
  try {
    const { blobs } = await list()
    
    // Filter for PDF files and map to response format
    const sheets = blobs
      .filter(blob => blob.pathname.endsWith('.pdf'))
      .map(blob => ({
        id: blob.pathname.replace('.pdf', ''),
        title: blob.pathname.replace('.pdf', ''),
        filePath: blob.url,
        fileSize: blob.size,
        uploadDate: blob.uploadedAt.toISOString(),
        setlistCount: 0,
        currentSetlists: []
      }))

    return NextResponse.json(sheets)
  } catch (error) {
    console.error("Error fetching sheets:", error)
    return NextResponse.json(
      { error: "Failed to fetch sheets" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Debug request headers
    console.log('Request headers:', Object.fromEntries(request.headers.entries()))
    
    // More flexible Content-Type check
    const contentType = request.headers.get('content-type')?.toLowerCase()
    const isMultipart = contentType?.includes('multipart/form-data')
    
    if (!isMultipart) {
      console.error('Invalid Content-Type:', contentType)
      return NextResponse.json(
        { 
          error: "Invalid request format",
          details: `Expected multipart/form-data, got ${contentType || 'undefined'}`,
          solution: "When uploading files, use FormData with Content-Type: multipart/form-data",
          example: `
            // Client-side JavaScript example:
            const formData = new FormData();
            formData.append('title', 'My Sheet');
            formData.append('file', fileInput.files[0]);
            
            const response = await fetch('/api/sheets', {
              method: 'POST',
              body: formData
              // Note: Don't set Content-Type header manually - 
              // the browser will set it automatically with boundary
            });
          `
        },
        { status: 400 }
      )
    }

    // Parse form data
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (error) {
      return NextResponse.json(
        { 
          error: "Invalid form data",
          details: "Could not parse multipart form data"
        },
        { status: 400 }
      )
    }

    // Validate required fields
    const title = formData.get("title")?.toString().trim()
    const file = formData.get("file") as File | null

    if (!title) {
      return NextResponse.json(
        { 
          error: "Validation failed",
          details: "Title is required"
        },
        { status: 400 }
      )
    }

    if (!file) {
      return NextResponse.json(
        { 
          error: "Validation failed",
          details: "PDF file is required"
        },
        { status: 400 }
      )
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { 
          error: "Invalid file type",
          details: "Only PDF files are accepted"
        },
        { status: 400 }
      )
    }

    const id = uuidv4()
    try {
      const blob = await put(`${id}.pdf`, file, {
        access: 'public',
        contentType: 'application/pdf',
        addRandomSuffix: false
      })

      return NextResponse.json({ 
        id, 
        title,
        filePath: blob.url,
        fileSize: file.size,
        uploadDate: new Date().toISOString()
      }, { status: 201 })
    } catch (blobError) {
      console.error("Error uploading to blob storage:", blobError)
      return NextResponse.json(
        { 
          error: "Failed to upload file",
          details: "Could not store file in blob storage"
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error uploading sheet:", error)
    return NextResponse.json(
      { error: "Failed to upload sheet" }, 
      { status: 500 }
    )
  }
}
