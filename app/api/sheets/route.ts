import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { v4 as uuidv4 } from "uuid"
import fs from "fs"
import path from "path"

export async function GET() {
  try {
    const db = getDb()
    if (!db) {
      throw new Error("Database not initialized")
    }

    interface SheetRow {
      id: string
      title: string
      filePath: string
      fileSize: number
      uploadDate: string
      setlistCount: number
      currentSetlists: string
    }

    interface SheetWithParsedSetlists extends Omit<SheetRow, 'currentSetlists'> {
      currentSetlists: string[]
    }

    const sheets = db.prepare(`
      SELECT 
        s.id, 
        s.title, 
        s.filePath, 
        s.fileSize, 
        s.uploadDate,
        COUNT(ss.setlistId) as setlistCount,
        CASE 
          WHEN GROUP_CONCAT(ss.setlistId) IS NULL THEN '[]'
          ELSE '[' || GROUP_CONCAT('"' || ss.setlistId || '"') || ']'
        END as currentSetlists
      FROM sheets s
      LEFT JOIN setlist_sheets ss ON s.id = ss.sheetId
      GROUP BY s.id
      ORDER BY s.uploadDate DESC
    `).all()

    // Parse currentSetlists from JSON string to array
    const sheetsWithParsedSetlists = (sheets as SheetRow[]).map(sheet => ({
      ...sheet,
      currentSetlists: JSON.parse(sheet.currentSetlists) as string[]
    })) as SheetWithParsedSetlists[]

    return NextResponse.json(sheetsWithParsedSetlists)
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

    const db = getDb()
    if (!db) {
      throw new Error("Database not initialized")
    }
    const id = uuidv4()
    const uploadDir = path.join(process.cwd(), "public", "pdfs")
    const fileName = `${id}.pdf`
    const filePath = path.join(uploadDir, fileName)
    const publicPath = `/pdfs/${fileName}`
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Save file
    fs.writeFileSync(filePath, fileBuffer)

    // Store in database
    db.prepare(
      "INSERT INTO sheets (id, title, filePath, fileSize, uploadDate) VALUES (?, ?, ?, ?, ?)"
    ).run(
      id,
      title,
      publicPath,  // Store public path instead of filesystem path
      file.size,
      new Date().toISOString()
    )

    return NextResponse.json({ 
      id, 
      title,
      filePath: publicPath
    }, { status: 201 })
  } catch (error) {
    console.error("Error uploading sheet:", error)
    return NextResponse.json(
      { error: "Failed to upload sheet" }, 
      { status: 500 }
    )
  }
}
