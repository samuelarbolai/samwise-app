"use client"

import { useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import {
  FileText,
  Sparkles,
  Send,
  FilePlus,
  ExternalLink,
  User,
  Mic,
  Languages,
  Phone,
  Clock,
  PhoneCall,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

// Cloud function endpoints. Update CREATE_DOC_URL after the first
// deploy if Firebase landed the function on a different hash than
// `createritualdoc-b6fhjlgejq-uc.a.run.app` (it usually preserves
// the project hash, mirroring registernewritual).
const CREATE_DOC_URL =
  "https://createritualdoc-b6fhjlgejq-uc.a.run.app"
const REGISTER_RITUAL_URL =
  "https://registernewritual-b6fhjlgejq-uc.a.run.app"

type View = "create" | "register"

interface NavItem {
  id: View
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { id: "create", label: "Create Ritual Doc", icon: FilePlus },
  { id: "register", label: "Register Ritual", icon: Sparkles },
]

export default function RegisterRitualPage() {
  const [view, setView] = useState<View>("create")

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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Demo Call copilot">
                    <Link href="/copilot">
                      <Sparkles className="h-4 w-4" />
                      <span>Demo Call copilot</span>
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
          {view === "create" && <CreateRitualDocCard />}
          {view === "register" && <RegisterRitualCard />}
        </main>
      </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

// =====================================================================
// Create Ritual Doc — metadata form. Pre-fills the canonical template
// with the 5 metadata values, returns a URL to the new copy.
// =====================================================================

interface MetadataForm {
  name: string
  voiceID: string
  language: string
  phoneNumber: string
  timeZone: string
}

type MetadataField = keyof MetadataForm

const INITIAL_METADATA: MetadataForm = {
  name: "",
  voiceID: "",
  language: "en",
  phoneNumber: "",
  timeZone: "",
}

function CreateRitualDocCard() {
  const [metadata, setMetadata] = useState<MetadataForm>(INITIAL_METADATA)
  const [errors, setErrors] = useState<
    Partial<Record<MetadataField, string>>
  >({})
  const [isCreating, setIsCreating] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [createdUserId, setCreatedUserId] = useState<string | null>(null)

  const validateField = (
    field: MetadataField,
    value: string,
  ): string | null => {
    const trimmed = value.trim()
    if (!trimmed) return "Required"
    if (field === "phoneNumber" && !/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      return "Use E.164, e.g. +573168248411"
    }
    if (field === "timeZone" && !/^[A-Za-z_]+\/[A-Za-z_]+/.test(trimmed)) {
      return "Use IANA, e.g. America/Bogota"
    }
    return null
  }

  const setField = (field: MetadataField, value: string) => {
    setMetadata((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        const error = validateField(field, value)
        if (error) next[field] = error
        else delete next[field]
        return next
      })
    }
  }

  const validateAll = (): boolean => {
    const next: Partial<Record<MetadataField, string>> = {}
    ;(Object.keys(metadata) as MetadataField[]).forEach((field) => {
      const error = validateField(field, metadata[field])
      if (error) next[field] = error
    })
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateAll()) return
    setIsCreating(true)
    setCreatedUrl(null)
    setCreatedUserId(null)
    try {
      const res = await fetch(CREATE_DOC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: metadata.name.trim(),
          voiceID: metadata.voiceID.trim(),
          language: metadata.language.trim(),
          phoneNumber: metadata.phoneNumber.trim(),
          timeZone: metadata.timeZone.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.documentUrl) {
        setCreatedUrl(data.documentUrl)
        if (data.userID) setCreatedUserId(data.userID)
        toast.success("Ritual doc created", {
          description:
            "Metadata pre-filled. Open the doc to fill in Problem-Solution and Ritual Call.",
        })
      } else {
        toast.error("Could not create doc", {
          description: data.error || "Unknown error.",
        })
      }
    } catch (err) {
      toast.error("Connection error", {
        description: err instanceof Error ? err.message : "Network failed.",
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create Ritual Doc</CardTitle>
        <CardDescription>
          Enter the user's metadata. We'll copy the canonical template into your Samwise Rituals folder with these values pre-filled.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="meta-name">
                <User className="h-4 w-4" />
                Name
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="meta-name"
                type="text"
                placeholder="e.g. Thomas"
                value={metadata.name}
                onChange={(e) => setField("name", e.target.value)}
                disabled={isCreating}
                aria-invalid={!!errors.name}
              />
              {errors.name && <FieldError>{errors.name}</FieldError>}
            </Field>

            <Field data-invalid={!!errors.voiceID}>
              <FieldLabel htmlFor="meta-voiceID">
                <Mic className="h-4 w-4" />
                Voice ID
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="meta-voiceID"
                type="text"
                placeholder="Cartesia voice UUID"
                value={metadata.voiceID}
                onChange={(e) => setField("voiceID", e.target.value)}
                disabled={isCreating}
                aria-invalid={!!errors.voiceID}
              />
              {errors.voiceID && <FieldError>{errors.voiceID}</FieldError>}
            </Field>

            <Field data-invalid={!!errors.language}>
              <FieldLabel htmlFor="meta-language">
                <Languages className="h-4 w-4" />
                Language
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Select
                value={metadata.language}
                onValueChange={(v) => setField("language", v)}
                disabled={isCreating}
              >
                <SelectTrigger id="meta-language" className="w-full">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English (en)</SelectItem>
                  <SelectItem value="es">Spanish (es)</SelectItem>
                </SelectContent>
              </Select>
              {errors.language && <FieldError>{errors.language}</FieldError>}
            </Field>

            <Field data-invalid={!!errors.phoneNumber}>
              <FieldLabel htmlFor="meta-phoneNumber">
                <Phone className="h-4 w-4" />
                Phone Number
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="meta-phoneNumber"
                type="tel"
                placeholder="+573168248411"
                value={metadata.phoneNumber}
                onChange={(e) => setField("phoneNumber", e.target.value)}
                disabled={isCreating}
                aria-invalid={!!errors.phoneNumber}
              />
              {errors.phoneNumber && (
                <FieldError>{errors.phoneNumber}</FieldError>
              )}
            </Field>

            <Field data-invalid={!!errors.timeZone}>
              <FieldLabel htmlFor="meta-timeZone">
                <Clock className="h-4 w-4" />
                Time Zone
                <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="meta-timeZone"
                type="text"
                placeholder="America/Bogota"
                value={metadata.timeZone}
                onChange={(e) => setField("timeZone", e.target.value)}
                disabled={isCreating}
                aria-invalid={!!errors.timeZone}
              />
              {errors.timeZone && <FieldError>{errors.timeZone}</FieldError>}
            </Field>

            <Button type="submit" className="w-full mt-2" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Spinner className="mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <FilePlus className="mr-2 h-4 w-4" />
                  Create Doc
                </>
              )}
            </Button>
          </FieldGroup>
        </form>

        {createdUrl && (
          <div className="mt-6 border-t pt-6 flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Doc created with metadata pre-filled. Open it to write the Problem-Solution and Ritual Call sections, then copy the URL into the Register view.
            </p>
            {createdUserId && (
              <div className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">Generated User ID</p>
                <code className="text-xs break-all font-mono">
                  {createdUserId}
                </code>
              </div>
            )}
            <Button asChild variant="secondary" className="w-full">
              <a href={createdUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Doc
              </a>
            </Button>
            <code className="text-xs break-all text-muted-foreground">
              {createdUrl}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =====================================================================
// Register New Ritual — original flow, unchanged behavior.
// =====================================================================

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
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Register New Ritual</CardTitle>
        <CardDescription>
          Connect your Google Doc to register a new ritual
        </CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}
