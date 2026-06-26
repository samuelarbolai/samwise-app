import type { ReactNode } from "react"

// Apply the editorial brand skin to /behavioural-design (see globals.css
// `.brand-editorial`). Scoped per-segment so /trip + /outreach keep their
// own dBase/Lotus paper aesthetic. Mirrors /ritual-creation/layout.tsx.
export default function BehaviouralDesignLayout({ children }: { children: ReactNode }) {
  return <div className="brand-editorial min-h-svh">{children}</div>
}
