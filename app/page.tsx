"use client"

import { useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import {
  FileText,
  Sparkles,
  Send,
  PhoneCall,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
} from "@/components/ui/field"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

const REGISTER_RITUAL_URL =
  "https://registernewritual-b6fhjlgejq-uc.a.run.app"

type View = "register"

interface NavItem {
  id: View
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { id: "register", label: "Register Ritual", icon: Sparkles },
]

export default function RegisterRitualPage() {
  const [view, setView] = useState<View>("register")

  return (
    <div className="brand-editorial">
      <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <div className="flex items-center px-2 py-1.5">
            <span className="brand-wordmark text-[17px]">
              Samwise
              <span className="brand-wordmark__star">✦</span>
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operator tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={view === item.id}
                      onClick={() => setView(item.id)}
                      tooltip={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>User experience</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Ritual call">
                    <Link href="/ritual-call">
                      <PhoneCall className="h-4 w-4" />
                      <span>Ritual call</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <p className="px-2 py-1 text-xs text-muted-foreground">
            Internal tools · v1
          </p>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Top bar with the sidebar trigger so the operator can collapse / re-open the sidebar from any view. */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
          <SidebarTrigger />
          <h1 className="text-sm font-medium">
            {NAV.find((n) => n.id === view)?.label}
          </h1>
        </header>

        <main className="flex flex-1 flex-col items-center justify-start p-4 py-12">
          {view === "register" && <RegisterRitualCard />}
        </main>
      </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

function RegisterRitualCard() {
  const [googleDocLink, setGoogleDocLink] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [userInputs, setUserInputs] = useState<string | null>(null)

  const validateLink = (link: string): boolean => {
    if (!link.trim()) {
      setLinkError("Google Docs Link is required")
      return false
    }
    setLinkError(null)
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateLink(googleDocLink)) return
    setIsLoading(true)
    try {
      const response = await fetch(REGISTER_RITUAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleDocLink: googleDocLink.trim() }),
      })
      const data = await response.json()
      if (response.ok) {
        toast.success("Ritual Registered!", {
          description:
            data.message || "Your ritual has been successfully registered.",
        })
        if (data.userInputs) setUserInputs(data.userInputs)
        setGoogleDocLink("")
      } else {
        toast.error("Registration Failed", {
          description: data.error || "Something went wrong. Please try again.",
        })
      }
    } catch (error) {
      toast.error("Connection Error", {
        description:
          error instanceof Error
            ? error.message
            : "Failed to connect to the server. Please check your internet connection and try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg">
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field data-invalid={!!linkError}>
            <FieldLabel htmlFor="google-doc-link">
              <FileText className="h-4 w-4" />
              Google Docs Link
              <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="google-doc-link"
              type="url"
              placeholder="https://docs.google.com/document/d/..."
              value={googleDocLink}
              onChange={(e) => {
                setGoogleDocLink(e.target.value)
                if (linkError) validateLink(e.target.value)
              }}
              disabled={isLoading}
              aria-invalid={!!linkError}
              aria-describedby={linkError ? "link-error" : undefined}
            />
            {linkError && (
              <FieldError id="link-error">{linkError}</FieldError>
            )}
          </Field>
          <Button type="submit" className="w-full mt-2" disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner className="mr-2" />
                Registering...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Register Ritual
              </>
            )}
          </Button>
        </FieldGroup>
      </form>

      {userInputs && (
        <div className="mt-6 border-t pt-6">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            User Inputs
          </h3>
          <div className="bg-muted rounded-lg p-4 max-h-64 overflow-auto">
            <pre className="text-sm whitespace-pre-wrap break-words font-mono text-foreground">
              {userInputs}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
