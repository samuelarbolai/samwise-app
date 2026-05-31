import type { ReactNode } from "react"

// Apply the editorial brand skin to /ritual-call (see globals.css
// `.brand-editorial`). Scoped per-segment so /trip + /outreach keep their
// own dBase/Lotus paper aesthetic.
export default function RitualCallLayout({ children }: { children: ReactNode }) {
  return <div className="brand-editorial min-h-svh">{children}</div>
}
