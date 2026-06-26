"use client"

import { useState } from "react"
import { Sparkles, PhoneCall, ScrollText, Map } from "lucide-react"

import { RegisterRitualCard } from "@/components/register-ritual-card"
import { BehaviouralDesignExperience } from "@/components/behavioural-design/BehaviouralDesignExperience"
import { RitualCreationExperience } from "@/components/ritual-creation/RitualCreationExperience"
import { RitualCallExperience } from "@/components/ritual-call/RitualCallExperience"

type View = "register" | "behavioural-picture" | "build-ritual" | "ritual-call"

interface NavItem {
  id: View
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { id: "register", label: "Register Ritual", icon: Sparkles },
  { id: "behavioural-picture", label: "Behavioural picture", icon: Map },
  { id: "build-ritual", label: "Build ritual", icon: ScrollText },
  { id: "ritual-call", label: "Ritual call", icon: PhoneCall },
]

// Verbatim copy of samwise-landing/app/page.tsx:FourPointStar — same
// brand mark, pixel-for-pixel.
function FourPointStar({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0 Q13 11, 24 12 Q13 13, 12 24 Q11 13, 0 12 Q11 11, 12 0 Z" />
    </svg>
  )
}

export default function RegisterRitualPage() {
  const [view, setView] = useState<View>("register")
  const [open, setOpen] = useState(false)

  return (
    <div className="brand-editorial relative min-h-svh">
      {/* MAIN — full-bleed, NOT padded for the sidebar. The sidebar floats
          ON TOP. Mirrors landing where the hero content sits behind the
          fixed nav (the nav-strip floats; content doesn't reserve room
          for it sideways). */}
      <main className="min-h-svh">
        {view === "register" && (
          <div className="flex flex-col items-center justify-start p-4 py-12">
            <RegisterRitualCard />
          </div>
        )}
        {view === "behavioural-picture" && <BehaviouralDesignExperience />}
        {view === "build-ritual" && <RitualCreationExperience />}
        {view === "ritual-call" && <RitualCallExperience />}
      </main>

      {/* Vertical mirror of samwise-landing's collapse-to-star navbar.
          Built without shadcn's Sidebar — that one slides in/out and
          reserves a sidebar-gap that pushes content. Landing's nav does
          neither: it's ALWAYS fixed-rendered along the edge, and the
          open/close is pure opacity + scale + backdrop-filter, with no
          layout impact. This is the 90°-rotated version of that.

          Mouse-enter the strip → opens. Mouse-leave → closes. Click the
          star toggles for touch / accidental-leave recovery. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col items-center transition-[background,backdrop-filter,-webkit-backdrop-filter] duration-[250ms] ease-out ${
          open
            ? "bg-[rgba(255,255,255,0.82)] [backdrop-filter:saturate(150%)_blur(14px)] [-webkit-backdrop-filter:saturate(150%)_blur(14px)]"
            : "bg-transparent"
        }`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        // pointer-events: only the star is hittable when closed; whole
        // aside is hittable when open. Same trick landing uses so casual
        // mouse motion across the left edge doesn't trigger expansion.
        style={{ pointerEvents: open ? "auto" : "none" }}
      >
        {/* The star — always rendered; visible only when closed. */}
        <button
          type="button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-2 text-[var(--accent-gold)] transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            open
              ? "pointer-events-none scale-[0.6] opacity-0"
              : "pointer-events-auto scale-100 opacity-100"
          }`}
        >
          <FourPointStar size={20} />
        </button>

        {/* Content — title pinned at top, options at vertical center.
            Fades in + scales from 0.96 → 1, same as landing nav-content. */}
        <div
          aria-hidden={!open}
          className={`flex h-full w-full flex-col items-stretch transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
            open
              ? "scale-100 opacity-100"
              : "pointer-events-none scale-[0.96] opacity-0"
          }`}
        >
          {/* Title — pinned at top, left-aligned to match the menu icons
              (x=24 from aside's left edge: outer px-3 + button px-3). */}
          <div className="flex items-center pl-6 pt-4 pb-2">
            <span className="brand-wordmark text-[17px]">
              Samwise
              <span className="brand-wordmark__star">✦</span>
            </span>
          </div>

          {/* Options — vertically centered in remaining space (flex-1 + justify-center) */}
          <div className="flex flex-1 flex-col items-stretch justify-center gap-1 px-3">
            {NAV.map((item) => {
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-[var(--accent-gold)]/15 text-foreground"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Invisible hover-zone extension to the right of the strip.
            Same trick as landing's ::after — keeps the cursor from
            falling through a gap while the user is travelling toward
            a menu item. Inherits pointer-events from the parent (so
            it only captures when open). */}
        <div className="pointer-events-none absolute inset-y-0 left-full w-16" />
      </aside>
    </div>
  )
}
