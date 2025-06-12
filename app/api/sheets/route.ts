import { NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { put, list } from '@vercel/blob'

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
  setlistCount?: number
  currentSetlists?: string[]
}

interface Setlist {
  id: string
  name: string
  createdAt: string
  sheets: string[]
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
    
    return sheets.sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
  } catch (error) {
    console.error("Error listing sheets:", error)
    return []
  }
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
    
    return setlists
  } catch (error) {
    console.error("Error listing setlists:", error)
    return []
  }
}

export async function GET() {
  try {
    const [sheets, setlists] = await Promise.all([getSheets(), getSetlists()])
    
    // Add setlist information to each sheet
    const sheetsWithSetlists = sheets.map(sheet => {
      const currentSetlists = setlists
        .filter(setlist => setlist.sheets.includes(sheet.id))
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
          solution: "When uploading files, use FormData with Content-Type: multipart/form-data"
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
          details: "File is required"
        },
        { status: 400 }
      )
    }

    // Validate file type using both MIME type and extension
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
      
      // Determine file extension and content type
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      let contentType = file.type
      let folderPrefix = 'files'
      
      if (fileExtension === '.pdf' || file.type === 'application/pdf') {
        contentType = 'application/pdf'
        folderPrefix = 'pdfs'
      } else if (['.png', '.jpg', '.jpeg'].includes(fileExtension) || file.type.startsWith('image/')) {
        contentType = file.type || 'image/jpeg'
        folderPrefix = 'images'
      }
      
      // Upload file with appropriate extension and content type
      const fileBlob = await put(`${folderPrefix}/${id}${fileExtension}`, buffer, {
        access: 'public',
        contentType: contentType,
        addRandomSuffix: false,
        multipart: true,
        token
      })

      // Create sheet metadata
      const sheetMetadata: Sheet = {
        id,
        title,
        filePath: fileBlob.url,
        fileSize: file.size,
        uploadDate,
        updatedAt: uploadDate,
        fileType: contentType
      }

      // Upload metadata as JSON
      const metadataBlob = await put(`sheets/${id}.json`, JSON.stringify(sheetMetadata), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
        token
      })

      return NextResponse.json(sheetMetadata, { status: 201 })
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
