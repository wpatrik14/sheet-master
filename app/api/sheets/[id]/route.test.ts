import { describe, it, expect, beforeEach } from "vitest"
import { getDb } from "@/lib/db"
import { GET, PATCH, DELETE } from "./route"

beforeEach(() => {
  const db = getDb()
  db.exec("DELETE FROM sheet_performances; DELETE FROM setlist_sheets; DELETE FROM setlists; DELETE FROM sheets;")
})

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

// filePath deliberately does not correspond to a real file on disk - the
// DELETE handler checks existsSync() before unlinking, so these tests
// exercise the DB/setlist-cleanup logic without touching the filesystem.
function insertSheet(id: string, overrides: Partial<{ title: string; source: string | null; updatedAt: string }> = {}) {
  const db = getDb()
  const now = overrides.updatedAt ?? new Date().toISOString()
  db.prepare(
    "INSERT INTO sheets (id, title, filePath, fileSize, uploadDate, updatedAt, fileType, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, overrides.title ?? "Teszt kotta", `/sheets/${id}.pdf`, 1234, now, now, "application/pdf", overrides.source ?? null)
}

describe("GET /api/sheets/[id]", () => {
  it("returns 404 for a sheet that does not exist", async () => {
    const response = await GET(new Request("http://localhost"), makeContext("missing-id"))
    expect(response.status).toBe(404)
  })

  it("returns the sheet with a file alias of filePath", async () => {
    insertSheet("sheet-1", { title: "Áldás" })

    const response = await GET(new Request("http://localhost"), makeContext("sheet-1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBe("Áldás")
    expect(body.file).toBe(body.filePath)
  })
})

describe("PATCH /api/sheets/[id]", () => {
  it("returns 404 for a sheet that does not exist", async () => {
    const response = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ title: "x" }) }),
      makeContext("missing-id")
    )
    expect(response.status).toBe(404)
  })

  it("rejects an empty title with 400", async () => {
    insertSheet("sheet-2")

    const response = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ title: "   " }) }),
      makeContext("sheet-2")
    )
    expect(response.status).toBe(400)
  })

  it("rejects a request with no fields to update", async () => {
    insertSheet("sheet-3")

    const response = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({}) }),
      makeContext("sheet-3")
    )
    expect(response.status).toBe(400)
  })

  it("updates title, source and musicalKey, and bumps updatedAt", async () => {
    // An old, fixed updatedAt so the "did it actually change" check below
    // cannot pass merely because the insert and the PATCH happened to land
    // in the same millisecond (they easily can - both are synchronous
    // in-memory operations).
    insertSheet("sheet-4", { updatedAt: "2020-01-01T00:00:00.000Z" })
    const before = { updatedAt: "2020-01-01T00:00:00.000Z" }

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ title: "Új cím", source: "Dicsérem Neved 3", musicalKey: "G" }),
      }),
      makeContext("sheet-4")
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.title).toBe("Új cím")
    expect(body.source).toBe("Dicsérem Neved 3")
    expect(body.musicalKey).toBe("G")
    expect(body.updatedAt).not.toBe(before.updatedAt)
  })

  it("clears source when given an empty string", async () => {
    insertSheet("sheet-5", { source: "Dicsérem Neved 1" })

    const response = await PATCH(
      new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ source: "" }) }),
      makeContext("sheet-5")
    )
    const body = await response.json()

    expect(body.source).toBeNull()
  })
})

describe("DELETE /api/sheets/[id]", () => {
  it("returns 404 for a sheet that does not exist", async () => {
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeContext("missing-id"))
    expect(response.status).toBe(404)
  })

  it("deletes the sheet row", async () => {
    insertSheet("sheet-6")

    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeContext("sheet-6"))
    expect(response.status).toBe(200)

    const db = getDb()
    expect(db.prepare("SELECT * FROM sheets WHERE id = ?").get("sheet-6")).toBeUndefined()
  })

  it("removes the sheet from every setlist it was in and reorders remaining positions", async () => {
    insertSheet("sheet-7")
    insertSheet("sheet-8")
    insertSheet("sheet-9")
    const db = getDb()
    db.prepare("INSERT INTO setlists (id, name, createdAt) VALUES (?, ?, ?)").run(
      "sl-1",
      "Este",
      new Date().toISOString()
    )
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run("sl-1", "sheet-7", 0)
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run("sl-1", "sheet-8", 1)
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run("sl-1", "sheet-9", 2)

    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeContext("sheet-8"))
    expect(response.status).toBe(200)

    const remaining = db
      .prepare("SELECT sheetId, position FROM setlist_sheets WHERE setlistId = ? ORDER BY position")
      .all("sl-1") as { sheetId: string; position: number }[]

    expect(remaining).toEqual([
      { sheetId: "sheet-7", position: 0 },
      { sheetId: "sheet-9", position: 1 },
    ])
  })
})
