import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/firebase-admin"

function normalizeEmail(email: string): string {
  return email
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.trim()
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 })
  }
  const therapistId = normalizeEmail(email)
  // No server-side orderBy — that would require a composite index on
  // (therapistId asc, createdAt desc). Sort client-side; limit caps the
  // working set so this stays cheap regardless of how many scripts a
  // therapist has accumulated.
  const snap = await getDb()
    .collection("customScripts")
    .where("therapistId", "==", therapistId)
    .limit(50)
    .get()
  const scripts = snap.docs
    .map((d) => {
      const data = d.data() as {
        therapistId: string
        frameworkName: string
        content: string
        createdAt?: { toMillis(): number }
        updatedAt?: { toMillis(): number }
      }
      return {
        scriptId: d.id,
        therapistId: data.therapistId,
        frameworkName: data.frameworkName,
        createdAt: data.createdAt?.toMillis() ?? null,
        updatedAt: data.updatedAt?.toMillis() ?? null,
        contentPreview: (data.content ?? "").slice(0, 200),
      }
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  return NextResponse.json({ therapistId, scripts })
}
