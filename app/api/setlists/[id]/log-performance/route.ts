import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

// Marks every sheet currently in this setlist as "sung today". Idempotent —
// calling this multiple times the same day (e.g. re-opening /perform) does
// not inflate the count, thanks to the UNIQUE(sheetId, performedDate)
// constraint on sheet_performances.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: setlistId } = await context.params
    const db = getDb()

    const setlist = db.prepare("SELECT id FROM setlists WHERE id = ?").get(setlistId) as { id: string } | undefined
    if (!setlist) {
      return NextResponse.json(
        { error: "Dal-lista nem található" },
        { status: 404 }
      )
    }

    const sheetIds = db
      .prepare("SELECT sheetId FROM setlist_sheets WHERE setlistId = ?")
      .all(setlistId) as { sheetId: string }[]

    const insertStmt = db.prepare(
      "INSERT OR IGNORE INTO sheet_performances (sheetId, performedDate, setlistId) VALUES (?, date('now', 'localtime'), ?)"
    )
    const insertTransaction = db.transaction((ids: string[]) => {
      for (const sheetId of ids) {
        insertStmt.run(sheetId, setlistId)
      }
    })
    insertTransaction(sheetIds.map((s) => s.sheetId))

    return NextResponse.json({ logged: sheetIds.length })
  } catch (error) {
    console.error("Error logging setlist performance:", error)
    return NextResponse.json(
      { error: "Failed to log performance" },
      { status: 500 }
    )
  }
}
