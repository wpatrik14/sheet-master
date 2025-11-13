import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { getDb } from "@/lib/db"
import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"

const UPLOAD_DIR = path.join(process.cwd(), "public", "sheets")

// Ensure the upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  fs.mkdir(UPLOAD_DIR, { recursive: true })
}

interface Sheet {
  id: string
  title: string
  filePath: string
  fileSize: number
  uploadDate: string
  updatedAt: string
  fileType: string
  setlistCount?: number
  currentSetlists?: string[]
}

interface Setlist {
  id: string
  name: string
  createdAt: string
  sheets: string[]
}

export async function GET() {
  try {
    const db = getDb()
    const sheets = db.prepare("SELECT id, title, filePath, fileSize, uploadDate, updatedAt, fileType FROM sheets ORDER BY uploadDate DESC").all() as Sheet[]
    const setlists = db.prepare("SELECT id, name, createdAt FROM setlists").all() as Setlist[]
    
    // Add setlist information to each sheet
    const sheetsWithSetlists = sheets.map(sheet => {
      const currentSetlists = setlists
        .filter(setlist => {
          const sheetsInSetlist = db.prepare("SELECT sheetId FROM setlist_sheets WHERE setlistId = ?").all(setlist.id) as { sheetId: string }[]
          return sheetsInSetlist.some(s => s.sheetId === sheet.id)
        })
        .map(setlist => setlist.id)
      
      return {
        ...sheet,
        setlistCount: currentSetlists.length,
        currentSetlists
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
    const contentType = request.headers.get('content-type')?.toLowerCase()
    const isMultipart = contentType?.includes('multipart/form-data')
    
    if (!isMultipart) {
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: `Expected multipart/form-data, got ${contentType || 'undefined'}`,
          solution: "When uploading files, use FormData with Content-Type: multipart/form-data"
        },
        { status: 400 }
      )
    }

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
          details: "File is required"
        },
        { status: 400 }
      )
    }

    const allowedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg"
    ]
    
    const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)
    
    if (!isValidType) {
      return NextResponse.json(
        {
          error: "Invalid file type",
          details: "Only PDF, PNG, and JPG files are accepted"
        },
        { status: 400 }
      )
    }

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
      const buffer = Buffer.from(await file.arrayBuffer())
      
      const fileName = `${id}${fileExtension}`
      const filePath = path.join(UPLOAD_DIR, fileName)
      const publicFilePath = `/sheets/${fileName}` // Path accessible from the browser

      await fs.writeFile(filePath, buffer)
      
      const db = getDb()
      const sheetMetadata: Sheet = {
        id,
        title,
        filePath: publicFilePath,
        fileSize: file.size,
        uploadDate,
        updatedAt: uploadDate,
        fileType: file.type
      }

      db.prepare("INSERT INTO sheets (id, title, filePath, fileSize, uploadDate, updatedAt, fileType) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        sheetMetadata.id,
        sheetMetadata.title,
        sheetMetadata.filePath,
        sheetMetadata.fileSize,
        sheetMetadata.uploadDate,
        sheetMetadata.updatedAt,
        sheetMetadata.fileType
      )

      return NextResponse.json(sheetMetadata, { status: 201 })
    } catch (fileError: any) {
      console.error("Error uploading file:", fileError)
      return NextResponse.json(
        {
          error: "Failed to upload file",
          details: "Could not store file locally",
          message: fileError?.message || 'Unknown error',
          code: fileError?.code || 'UNKNOWN'
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
