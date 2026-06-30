// Applies the editorial brand skin to every /ritual-doc/* page — same
// per-segment pattern used by /for-experts, /meet, and /ritual-call.
// See context-for-code-agent.md → "Editorial brand skin".
export default function RitualDocLayout({ children }: { children: React.ReactNode }) {
  return <div className="brand-editorial min-h-screen">{children}</div>;
}
