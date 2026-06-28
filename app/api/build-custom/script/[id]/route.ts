import { FieldValue } from "firebase-admin/firestore"
import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/firebase-admin"

interface ScriptDoc {
  therapistId: string
  frameworkName: string
  content: string
  createdAt?: { toMillis(): number }
  updatedAt?: { toMillis(): number }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 })
  }
  const snap = await getDb().collection("customScripts").doc(id).get()
  if (!snap.exists) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  const data = snap.data() as ScriptDoc
  return NextResponse.json({
    scriptId: id,
    therapistId: data.therapistId,
    frameworkName: data.frameworkName,
    content: data.content,
    updatedAt: data.updatedAt?.toMillis() ?? null,
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 })
  }
  const body = (await req.json().catch(() => ({}))) as { content?: string }
  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "content (string) required" },
      { status: 400 }
    )
  }
  const ref = getDb().collection("customScripts").doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
  await ref.update({
    content: body.content,
    updatedAt: FieldValue.serverTimestamp(),
  })
  return NextResponse.json({ ok: true })
}
