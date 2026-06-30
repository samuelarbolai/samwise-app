"use client"

import { useState } from "react"
import { Sparkles, PhoneCall, ScrollText, Map, FileText } from "lucide-react"

import { RegisterRitualCard } from "@/components/register-ritual-card"
import { NewRitualDocCard } from "@/components/new-ritual-doc-card"
import { BehaviouralDesignExperience } from "@/components/behavioural-design/BehaviouralDesignExperience"
import { RitualCreationExperience } from "@/components/ritual-creation/RitualCreationExperience"
import { RitualCallExperience } from "@/components/ritual-call/RitualCallExperience"
import { SidebarNav, type SidebarNavItem } from "@/components/sidebar-nav"

type View = "register" | "ritual-doc" | "behavioural-picture" | "build-ritual" | "ritual-call"

const NAV: readonly SidebarNavItem<View>[] = [
  { id: "register", label: "Register Ritual", icon: Sparkles },
  { id: "ritual-doc", label: "Ritual doc", icon: FileText },
  { id: "behavioural-picture", label: "Behavioural picture", icon: Map },
  { id: "build-ritual", label: "Build ritual", icon: ScrollText },
  { id: "ritual-call", label: "Ritual call", icon: PhoneCall },
]

export default function RegisterRitualPage() {
  const [view, setView] = useState<View>("register")

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
        {view === "ritual-doc" && (
          <div className="flex flex-col items-center justify-start p-4 py-12">
            <NewRitualDocCard />
          </div>
        )}
        {view === "behavioural-picture" && <BehaviouralDesignExperience />}
        {view === "build-ritual" && <RitualCreationExperience />}
        {view === "ritual-call" && <RitualCallExperience />}
      </main>

      <SidebarNav items={NAV} active={view} onChange={setView} />
    </div>
  )
}
