import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextRequest, NextResponse } from "next/server"

const ALLOWED = new Set([
  "adaptation-procedure",
  "custom-script-template",
  "cpt-worked-example",
  "cpt-worked-example-stale-v1",
])

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")
  if (!name || !ALLOWED.has(name)) {
    return NextResponse.json({ error: "unknown artifact" }, { status: 400 })
  }
  const file = path.join(
    process.cwd(),
    "app",
    "for-experts",
    "_artifacts",
    `${name}.md`
  )
  try {
    const md = await readFile(file, "utf8")
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json(
      { error: "artifact not yet authored", name },
      { status: 404 }
    )
  }
}
