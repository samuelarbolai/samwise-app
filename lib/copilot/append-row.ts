export const APPEND_DEMO_CALL_ROW_URL =
  "https://appenddemocallrow-b6fhjlgejq-uc.a.run.app"

export async function appendDemoCallRow(
  row: Record<string, string>,
): Promise<{ ok: true; rowNumber: number }> {
  const res = await fetch(APPEND_DEMO_CALL_ROW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `appendDemoCallRow failed (${res.status})`)
  }
  return await res.json()
}
