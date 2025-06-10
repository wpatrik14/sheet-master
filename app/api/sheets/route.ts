import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { put, list } from '@vercel/blob'
import { getDb } from "@/lib/db"

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
  setlistCount: number
}

interface Setlist {
  id: string
  name: string
}

export async function GET() {
  try {
    const db = getDb()
    
    // Get sheets with setlist count
    const sheets = db.prepare(`
      SELECT 
        s.id,
        s.title,
        s.filePath,
        s.fileSize,
        s.uploadDate,
        s.updatedAt,
        COUNT(ss.setlistId) as setlistCount
      FROM sheets s
      LEFT JOIN setlist_sheets ss ON s.id = ss.sheetId
      GROUP BY s.id, s.title, s.filePath, s.fileSize, s.uploadDate, s.updatedAt
      ORDER BY s.uploadDate DESC
    `).all() as Sheet[]

    // Get current setlists for each sheet
    const sheetsWithSetlists = sheets.map(sheet => {
      const setlists = db.prepare(`
        SELECT sl.id, sl.name
        FROM setlists sl
        JOIN setlist_sheets ss ON sl.id = ss.setlistId
        WHERE ss.sheetId = ?
      `).all(sheet.id) as Setlist[]
      
      return {
        ...sheet,
        currentSetlists: setlists
      }
    })

    return NextResponse.json(sheetsWithSetlists)
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

    // Validate file type using both MIME type and extension
    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')
    if (!isPDF) {
      return NextResponse.json(
        { 
          error: "Invalid file type",
          details: "Only PDF files are accepted"
        },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          error: "File too large",
          details: "Maximum file size is 10MB"
        },
        { status: 400 }
      )
    }

    const id = uuidv4()
    const uploadDate = new Date().toISOString()
    
    try {
      // Ensure we're working with a Buffer for reliable upload
      const buffer = Buffer.from(await file.arrayBuffer())
      
      const blob = await put(`${id}.pdf`, buffer, {
        access: 'public',
        contentType: 'application/pdf',
        addRandomSuffix: false,
        multipart: true, // Enable multipart upload for large files
        token
      })

      // Save to database
      const db = getDb()
      const stmt = db.prepare("INSERT INTO sheets (id, title, filePath, fileSize, uploadDate, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
      stmt.run(id, title, blob.url, file.size, uploadDate, uploadDate)

      return NextResponse.json({ 
        id, 
        title,
        filePath: blob.url,
        fileSize: file.size,
        uploadDate,
        updatedAt: uploadDate
      }, { status: 201 })
    } catch (blobError: any) {
      console.error("Error uploading to blob storage:", blobError)
      return NextResponse.json(
        { 
          error: "Failed to upload file",
          details: "Could not store file in blob storage",
          message: blobError?.message || 'Unknown error',
          code: blobError?.code || 'UNKNOWN'
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
