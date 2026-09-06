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
  source: string | null
  musicalKey: string | null
  setlistCount?: number
  currentSetlists?: string[]
  lastSungDate?: string | null
  timesSungTotal?: number
  timesSungRecent?: number
}

export async function GET() {
  try {
    const db = getDb()
    const sheets = db
      .prepare(
        "SELECT id, title, filePath, fileSize, uploadDate, updatedAt, fileType, source, musicalKey FROM sheets ORDER BY title COLLATE NOCASE ASC"
      )
      .all() as Sheet[]
    const setlistMemberships = db
      .prepare("SELECT sheetId, setlistId FROM setlist_sheets")
      .all() as { sheetId: string; setlistId: string }[]
    const setlistIdsBySheetId = new Map<string, string[]>()
    for (const { sheetId, setlistId } of setlistMemberships) {
      const existing = setlistIdsBySheetId.get(sheetId)
      if (existing) {
        existing.push(setlistId)
      } else {
        setlistIdsBySheetId.set(sheetId, [setlistId])
      }
    }

    const performanceStats = db
      .prepare(
        `SELECT
           sheetId,
           MAX(performedDate) as lastSungDate,
           COUNT(*) as timesSungTotal,
           SUM(CASE WHEN performedDate >= date('now', 'localtime', '-90 days') THEN 1 ELSE 0 END) as timesSungRecent
         FROM sheet_performances
         GROUP BY sheetId`
      )
      .all() as { sheetId: string; lastSungDate: string; timesSungTotal: number; timesSungRecent: number }[]
    const statsBySheetId = new Map(performanceStats.map((s) => [s.sheetId, s]))

    // Add setlist information to each sheet
    const sheetsWithSetlists = sheets.map(sheet => {
      const currentSetlists = setlistIdsBySheetId.get(sheet.id) ?? []
      const stats = statsBySheetId.get(sheet.id)

      return {
        ...sheet,
        setlistCount: currentSetlists.length,
        currentSetlists,
        lastSungDate: stats?.lastSungDate ?? null,
        timesSungTotal: stats?.timesSungTotal ?? 0,
        timesSungRecent: stats?.timesSungRecent ?? 0,
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
    const contentType = request.headers.get("content-type")?.toLowerCase()
    const isMultipart = contentType?.includes("multipart/form-data")

    if (!isMultipart) {
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: `Expected multipart/form-data, got ${contentType || "undefined"}`,
          solution: "When uploading files, use FormData with Content-Type: multipart/form-data",
        },
        { status: 400 },
      )
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        {
          error: "Invalid form data",
          details: "Could not parse multipart form data",
        },
        { status: 400 },
      )
    }

    const title = formData.get("title")?.toString().trim()
    const uploadedFiles = [
      ...formData.getAll("file"),
      ...formData.getAll("files"),
    ].filter((item): item is File => item instanceof File)

    const files = uploadedFiles.filter((file) => file.size > 0)

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: "At least one file is required",
        },
        { status: 400 },
      )
    }

    const allowedTypes = ["application/pdf"]
    const allowedExtensions = [".pdf"]
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

    if (title && files.length > 1) {
      // Keep title support for backward compatibility, but each file will use its own filename when missing.
    }

    const db = getDb()
    const createdSheets: Sheet[] = []

    for (const file of files) {
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."))
      const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension)

      if (!isValidType) {
        return NextResponse.json(
          {
            error: "Invalid file type",
            details: `Only PDF files are accepted. Invalid file: ${file.name}`,
          },
          { status: 400 },
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: "File too large",
            details: `Maximum file size is 10MB. Invalid file: ${file.name}`,
          },
          { status: 400 },
        )
      }

      const id = uuidv4()
      const uploadDate = new Date().toISOString()
      const buffer = Buffer.from(await file.arrayBuffer())
      const fileName = `${id}${fileExtension}`
      const filePath = path.join(UPLOAD_DIR, fileName)
      const publicFilePath = `/sheets/${fileName}`
      const sheetTitle = title || file.name.replace(/\.[^/.]+$/, "")

      await fs.writeFile(filePath, buffer)

      const sheetMetadata: Sheet = {
        id,
        title: sheetTitle,
        filePath: publicFilePath,
        fileSize: file.size,
        uploadDate,
        updatedAt: uploadDate,
        fileType: file.type,
        source: null,
        musicalKey: null,
      }

      db.prepare(
        "INSERT INTO sheets (id, title, filePath, fileSize, uploadDate, updatedAt, fileType) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(
        sheetMetadata.id,
        sheetMetadata.title,
        sheetMetadata.filePath,
        sheetMetadata.fileSize,
        sheetMetadata.uploadDate,
        sheetMetadata.updatedAt,
        sheetMetadata.fileType,
      )

      createdSheets.push(sheetMetadata)
    }

    return NextResponse.json(createdSheets, { status: 201 })
  } catch (error) {
    console.error("Error uploading sheet:", error)
    return NextResponse.json(
      { error: "Failed to upload sheet" },
      { status: 500 },
    )
  }
}
