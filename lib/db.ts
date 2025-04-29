import type { Database } from "better-sqlite3"
import path from "path"
import fs from "fs"

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), "data")
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, "sheetmusic.db")

let dbInstance: Database | null = null

export function getDb(): Database {
  if (!dbInstance) {
    // Dynamic import to avoid issues with Next.js SSR
    const BetterSqlite3 = require("better-sqlite3")
    const db = new BetterSqlite3(dbPath)

    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS sheets (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        filePath TEXT NOT NULL,
        fileSize INTEGER NOT NULL,
        uploadDate TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      );
      
      CREATE TABLE IF NOT EXISTS setlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS setlist_sheets (
        setlistId TEXT NOT NULL,
        sheetId TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (setlistId, sheetId),
        FOREIGN KEY (setlistId) REFERENCES setlists(id) ON DELETE CASCADE,
        FOREIGN KEY (sheetId) REFERENCES sheets(id) ON DELETE CASCADE
      );
    `)
    dbInstance = db
  }

  if (!dbInstance) {
    throw new Error("Database failed to initialize")
  }

  return dbInstance
}
