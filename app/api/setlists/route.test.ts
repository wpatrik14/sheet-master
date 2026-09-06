import { describe, it, expect, beforeEach } from "vitest"
import { getDb } from "@/lib/db"
import { GET, POST } from "./route"

// All tests in this file share one in-memory DB (vitest module state is
// per test file, not per test case) - clear it before every test so
// tests cannot see leftover rows from one another.
beforeEach(() => {
  const db = getDb()
  db.exec("DELETE FROM setlist_sheets; DELETE FROM setlists; DELETE FROM sheets;")
})

describe("GET /api/setlists", () => {
  it("returns an empty list when there are no setlists", async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.setlists).toEqual([])
  })

  it("returns created setlists with a sheetCount and sheets array", async () => {
    const createResponse = await POST(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        body: JSON.stringify({ name: "Vasárnap reggel" }),
      })
    )
    expect(createResponse.status).toBe(201)

    const listResponse = await GET()
    const body = await listResponse.json()

    expect(body.setlists).toHaveLength(1)
    expect(body.setlists[0]).toMatchObject({
      name: "Vasárnap reggel",
      sheets: [],
      sheetCount: 0,
    })
  })
})

describe("POST /api/setlists", () => {
  it("creates a setlist and returns it with a generated id", async () => {
    const response = await POST(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        body: JSON.stringify({ name: "Ifjúsági alkalom" }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(typeof body.id).toBe("string")
    expect(body.name).toBe("Ifjúsági alkalom")
  })

  it("trims whitespace from the name", async () => {
    const response = await POST(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        body: JSON.stringify({ name: "  Estig  " }),
      })
    )
    const body = await response.json()

    expect(body.name).toBe("Estig")
  })

  it("rejects a missing name with 400", async () => {
    const response = await POST(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        body: JSON.stringify({}),
      })
    )

    expect(response.status).toBe(400)
  })

  it("rejects a blank (whitespace-only) name with 400", async () => {
    const response = await POST(
      new Request("http://localhost/api/setlists", {
        method: "POST",
        body: JSON.stringify({ name: "   " }),
      })
    )

    expect(response.status).toBe(400)
  })
})
