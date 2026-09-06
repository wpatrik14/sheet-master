import { describe, it, expect, beforeEach, vi } from "vitest"
import { getDb } from "@/lib/db"

// POST really calls fs.writeFile with a path under the real project's
// public/sheets directory (UPLOAD_DIR is computed once at module load
// from process.cwd() - not something a test can redirect without
// touching route.ts). Stub just writeFile so tests never touch disk;
// everything else in fs/promises stays real.
vi.mock("fs/promises", async (importOriginal) => {
  // fs/promises has no real "default" export - Node's CJS/ESM interop
  // synthesizes one at runtime as the whole namespace object, which is
  // what route.ts's `import fs from "fs/promises"` actually receives.
  // The module's type declarations don't reflect that synthetic shape,
  // hence the cast.
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    default: {
      ...actual,
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  }
})

import fsPromises from "fs/promises"
import { GET, POST } from "./route"

beforeEach(() => {
  vi.mocked(fsPromises.writeFile).mockClear()
  const db = getDb()
  db.exec("DELETE FROM sheet_performances; DELETE FROM setlist_sheets; DELETE FROM setlists; DELETE FROM sheets;")
})

function insertSheet(id: string, overrides: Partial<{ title: string; uploadDate: string }> = {}) {
  const db = getDb()
  const now = overrides.uploadDate ?? new Date().toISOString()
  db.prepare(
    "INSERT INTO sheets (id, title, filePath, fileSize, uploadDate, updatedAt, fileType) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, overrides.title ?? "Teszt kotta", `/sheets/${id}.pdf`, 1234, now, now, "application/pdf")
}

function makePdfFile(name = "kotta.pdf", size = 1024) {
  return new File([new Uint8Array(size)], name, { type: "application/pdf" })
}

describe("GET /api/sheets", () => {
  it("returns an empty array when there are no sheets", async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([])
  })

  it("sorts sheets by title, case-insensitively", async () => {
    insertSheet("s-1", { title: "zebra" })
    insertSheet("s-2", { title: "Alma" })

    const response = await GET()
    const body = await response.json()

    expect(body.map((s: { title: string }) => s.title)).toEqual(["Alma", "zebra"])
  })

  // SQLite's built-in NOCASE collation only folds ASCII A-Z/a-z - it does
  // not know that "Á" and "á" are the same letter, so accented titles can
  // sort after every plain ASCII letter instead of alongside their base
  // letter. Documenting the current (surprising) behavior rather than
  // asserting the ideal one - fixing this would mean a custom SQLite
  // collation or sorting sheets in JS after fetching, which is a bigger
  // change than this test-writing pass should make unprompted.
  it("does not sort Hungarian accented titles alongside their base letter (known limitation)", async () => {
    insertSheet("s-5", { title: "zsoltár" })
    insertSheet("s-6", { title: "Áldás" })

    const response = await GET()
    const body = await response.json()

    expect(body.map((s: { title: string }) => s.title)).toEqual(["zsoltár", "Áldás"])
  })

  it("reports setlist membership and performance stats per sheet", async () => {
    insertSheet("s-3")
    const db = getDb()
    db.prepare("INSERT INTO setlists (id, name, createdAt) VALUES (?, ?, ?)").run(
      "sl-1",
      "Vasárnap",
      new Date().toISOString()
    )
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run("sl-1", "s-3", 0)
    db.prepare("INSERT INTO sheet_performances (sheetId, performedDate, setlistId) VALUES (?, ?, ?)").run(
      "s-3",
      "2026-09-01",
      "sl-1"
    )

    const response = await GET()
    const body = await response.json()
    const sheet = body.find((s: { id: string }) => s.id === "s-3")

    expect(sheet.setlistCount).toBe(1)
    expect(sheet.currentSetlists).toEqual(["sl-1"])
    expect(sheet.timesSungTotal).toBe(1)
    expect(sheet.lastSungDate).toBe("2026-09-01")
  })

  it("defaults performance stats to zero/null for a never-sung sheet", async () => {
    insertSheet("s-4")

    const response = await GET()
    const body = await response.json()
    const sheet = body.find((s: { id: string }) => s.id === "s-4")

    expect(sheet.timesSungTotal).toBe(0)
    expect(sheet.timesSungRecent).toBe(0)
    expect(sheet.lastSungDate).toBeNull()
  })
})

describe("POST /api/sheets", () => {
  it("rejects a non-multipart request with 400", async () => {
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "x" }),
      })
    )

    expect(response.status).toBe(400)
  })

  it("rejects an upload with no files with 400", async () => {
    const formData = new FormData()
    formData.append("title", "Cím fájl nélkül")

    const response = await POST(new Request("http://localhost", { method: "POST", body: formData }))

    expect(response.status).toBe(400)
  })

  it("rejects a non-PDF file", async () => {
    const formData = new FormData()
    formData.append("file", new File(["hello"], "kep.png", { type: "image/png" }))

    const response = await POST(new Request("http://localhost", { method: "POST", body: formData }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid file type")
  })

  it("rejects a file over the 10MB limit", async () => {
    const formData = new FormData()
    formData.append("file", makePdfFile("nagy.pdf", 10 * 1024 * 1024 + 1))

    const response = await POST(new Request("http://localhost", { method: "POST", body: formData }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe("File too large")
  })

  it("accepts a valid PDF, writes it via fs.writeFile, and inserts a DB row", async () => {
    const formData = new FormData()
    formData.append("file", makePdfFile("103-zsoltar.pdf"))

    const response = await POST(new Request("http://localhost", { method: "POST", body: formData }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe("103-zsoltar")
    expect(body[0].source).toBeNull()
    expect(body[0].musicalKey).toBeNull()
    expect(vi.mocked(fsPromises.writeFile)).toHaveBeenCalledTimes(1)

    const db = getDb()
    const row = db.prepare("SELECT * FROM sheets WHERE id = ?").get(body[0].id)
    expect(row).toBeDefined()
  })

  it("uses the provided title instead of the filename when given", async () => {
    const formData = new FormData()
    formData.append("title", "Egyedi cím")
    formData.append("file", makePdfFile("valami.pdf"))

    const response = await POST(new Request("http://localhost", { method: "POST", body: formData }))
    const body = await response.json()

    expect(body[0].title).toBe("Egyedi cím")
  })

  it("uploads multiple files in one request", async () => {
    const formData = new FormData()
    formData.append("file", makePdfFile("a.pdf"))
    formData.append("file", makePdfFile("b.pdf"))

    const response = await POST(new Request("http://localhost", { method: "POST", body: formData }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toHaveLength(2)
    expect(vi.mocked(fsPromises.writeFile)).toHaveBeenCalledTimes(2)
  })
})
