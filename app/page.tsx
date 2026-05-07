"use client"

import { useState } from "react"
import { toast } from "sonner"
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

// Cloud function endpoints. Update CREATE_DOC_URL after the first
// deploy if Firebase landed the function on a different hash than
// `createritualdoc-b6fhjlgejq-uc.a.run.app` (it usually preserves
// the project hash, mirroring registernewritual).
const CREATE_DOC_URL =
  "https://createritualdoc-b6fhjlgejq-uc.a.run.app"
const REGISTER_RITUAL_URL =
  "https://registernewritual-b6fhjlgejq-uc.a.run.app"

interface MetadataForm {
  userID: string
  voiceID: string
  language: string
  phoneNumber: string
  timeZone: string
}

type MetadataField = keyof MetadataForm

const INITIAL_METADATA: MetadataForm = {
  userID: "",
  voiceID: "",
  language: "en",
  phoneNumber: "",
  timeZone: "",
}

export default function RegisterRitualPage() {
  // ----- "Create Ritual Doc" state -----
  const [metadata, setMetadata] = useState<MetadataForm>(INITIAL_METADATA)
  const [metadataErrors, setMetadataErrors] = useState<
    Partial<Record<MetadataField, string>>
  >({})
  const [isCreating, setIsCreating] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)

  // ----- "Register New Ritual" state (unchanged) -----
  const [googleDocLink, setGoogleDocLink] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [userInputs, setUserInputs] = useState<string | null>(null)

  const setField = (field: MetadataField, value: string) => {
    setMetadata((prev) => ({ ...prev, [field]: value }))
    if (metadataErrors[field]) {
      // Re-validate just this field so the error clears on a good fix
      // without forcing the whole form to revalidate on every keystroke.
      setMetadataErrors((prev) => {
        const next = { ...prev }
        const error = validateField(field, value)
        if (error) next[field] = error
        else delete next[field]
        return next
      })
    }
  }

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

  const validateAllMetadata = (): boolean => {
    const next: Partial<Record<MetadataField, string>> = {}
    ;(Object.keys(metadata) as MetadataField[]).forEach((field) => {
      const error = validateField(field, metadata[field])
      if (error) next[field] = error
    })
    setMetadataErrors(next)
    return Object.keys(next).length === 0
  }

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateAllMetadata()) return
    setIsCreating(true)
    setCreatedUrl(null)
    try {
      const res = await fetch(CREATE_DOC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userID: metadata.userID.trim(),
          voiceID: metadata.voiceID.trim(),
          language: metadata.language.trim(),
          phoneNumber: metadata.phoneNumber.trim(),
          timeZone: metadata.timeZone.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.documentUrl) {
        setCreatedUrl(data.documentUrl)
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

  // ----- existing "Register New Ritual" handler (unchanged) -----
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
    <main className="min-h-screen bg-background flex flex-col items-center justify-start gap-6 p-4 py-12">
      {/* ----- Create Ritual Doc Card ----- */}
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FilePlus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Ritual Doc</CardTitle>
          <CardDescription>
            Enter the user's metadata. We'll copy the canonical template into your Samwise Rituals folder with these values pre-filled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateDoc}>
            <FieldGroup>
              <Field data-invalid={!!metadataErrors.userID}>
                <FieldLabel htmlFor="meta-userID">
                  <User className="h-4 w-4" />
                  User ID
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="meta-userID"
                  type="text"
                  placeholder="Firebase Auth UID"
                  value={metadata.userID}
                  onChange={(e) => setField("userID", e.target.value)}
                  disabled={isCreating}
                  aria-invalid={!!metadataErrors.userID}
                />
                {metadataErrors.userID && (
                  <FieldError>{metadataErrors.userID}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!metadataErrors.voiceID}>
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
                  aria-invalid={!!metadataErrors.voiceID}
                />
                {metadataErrors.voiceID && (
                  <FieldError>{metadataErrors.voiceID}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!metadataErrors.language}>
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
                {metadataErrors.language && (
                  <FieldError>{metadataErrors.language}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!metadataErrors.phoneNumber}>
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
                  aria-invalid={!!metadataErrors.phoneNumber}
                />
                {metadataErrors.phoneNumber && (
                  <FieldError>{metadataErrors.phoneNumber}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!metadataErrors.timeZone}>
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
                  aria-invalid={!!metadataErrors.timeZone}
                />
                {metadataErrors.timeZone && (
                  <FieldError>{metadataErrors.timeZone}</FieldError>
                )}
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
                Doc created with metadata pre-filled. Open it to write the Problem-Solution and Ritual Call sections, then copy the URL into the Register form below.
              </p>
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

      {/* ----- Register New Ritual Card (UNCHANGED behavior) ----- */}
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
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
    </main>
  )
}
