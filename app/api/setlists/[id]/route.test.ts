import { describe, it, expect, beforeEach } from "vitest"
import { getDb } from "@/lib/db"
import { GET, PUT, POST, DELETE } from "./route"

beforeEach(() => {
  const db = getDb()
  db.exec("DELETE FROM setlist_sheets; DELETE FROM setlists; DELETE FROM sheets;")
})

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

function insertSetlist(id: string, name = "Teszt lista") {
  const db = getDb()
  const createdAt = new Date().toISOString()
  db.prepare("INSERT INTO setlists (id, name, createdAt) VALUES (?, ?, ?)").run(id, name, createdAt)
  return { id, name, createdAt }
}

function insertSheet(id: string, title = "Teszt kotta") {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare(
    "INSERT INTO sheets (id, title, filePath, fileSize, uploadDate, updatedAt, fileType) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, title, `/sheets/${id}.pdf`, 1234, now, now, "application/pdf")
  return { id, title }
}

describe("GET /api/setlists/[id]", () => {
  it("returns 404 for a setlist that does not exist", async () => {
    const response = await GET(new Request("http://localhost"), makeContext("missing-id"))
    expect(response.status).toBe(404)
  })

  it("returns the setlist with its sheets in position order", async () => {
    insertSetlist("sl-1", "Este")
    insertSheet("sheet-a", "A dal")
    insertSheet("sheet-b", "B dal")
    const db = getDb()
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run("sl-1", "sheet-b", 1)
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run("sl-1", "sheet-a", 0)

    const response = await GET(new Request("http://localhost"), makeContext("sl-1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.name).toBe("Este")
    expect(body.sheets.map((s: { id: string }) => s.id)).toEqual(["sheet-a", "sheet-b"])
  })
})

describe("PUT /api/setlists/[id]", () => {
  it("renames a setlist", async () => {
    insertSetlist("sl-2", "Régi név")

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify({ name: "Új név" }) }),
      makeContext("sl-2")
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.name).toBe("Új név")
  })

  it("rejects an empty name with 400", async () => {
    insertSetlist("sl-3")

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify({ name: "" }) }),
      makeContext("sl-3")
    )

    expect(response.status).toBe(400)
  })

  it("replaces the sheet order when sheets is provided", async () => {
    insertSetlist("sl-4")
    insertSheet("sheet-x")
    insertSheet("sheet-y")

    const response = await PUT(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ sheets: ["sheet-y", "sheet-x"] }),
      }),
      makeContext("sl-4")
    )
    expect(response.status).toBe(200)

    const db = getDb()
    const rows = db
      .prepare("SELECT sheetId, position FROM setlist_sheets WHERE setlistId = ? ORDER BY position")
      .all("sl-4") as { sheetId: string; position: number }[]

    expect(rows.map((r) => r.sheetId)).toEqual(["sheet-y", "sheet-x"])
  })

  it("returns 404 for a setlist that does not exist", async () => {
    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify({ name: "x" }) }),
      makeContext("missing-id")
    )
    expect(response.status).toBe(404)
  })
})

describe("POST /api/setlists/[id] (add sheet)", () => {
  it("adds a sheet to the setlist at the next position", async () => {
    insertSetlist("sl-5")
    insertSheet("sheet-1")

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ sheetId: "sheet-1" }) }),
      makeContext("sl-5")
    )
    expect(response.status).toBe(200)

    const db = getDb()
    const row = db
      .prepare("SELECT position FROM setlist_sheets WHERE setlistId = ? AND sheetId = ?")
      .get("sl-5", "sheet-1") as { position: number }
    expect(row.position).toBe(0)
  })

  it("rejects adding a sheet that does not exist", async () => {
    insertSetlist("sl-6")

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ sheetId: "no-such-sheet" }) }),
      makeContext("sl-6")
    )
    expect(response.status).toBe(404)
  })

  it("rejects adding the same sheet twice", async () => {
    insertSetlist("sl-7")
    insertSheet("sheet-2")
    const db = getDb()
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run("sl-7", "sheet-2", 0)

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ sheetId: "sheet-2" }) }),
      makeContext("sl-7")
    )
    expect(response.status).toBe(400)
  })
})

describe("DELETE /api/setlists/[id]", () => {
  it("deletes the setlist and cascades to setlist_sheets", async () => {
    insertSetlist("sl-8")
    insertSheet("sheet-3")
    const db = getDb()
    db.prepare("INSERT INTO setlist_sheets (setlistId, sheetId, position) VALUES (?, ?, ?)").run("sl-8", "sheet-3", 0)

    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeContext("sl-8"))
    expect(response.status).toBe(200)

    expect(db.prepare("SELECT * FROM setlists WHERE id = ?").get("sl-8")).toBeUndefined()
    expect(db.prepare("SELECT * FROM setlist_sheets WHERE setlistId = ?").all("sl-8")).toEqual([])
  })

  it("returns 404 for a setlist that does not exist", async () => {
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), makeContext("missing-id"))
    expect(response.status).toBe(404)
  })
})
