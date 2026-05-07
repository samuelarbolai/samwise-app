"use client"

import { useState } from "react"
import { toast } from "sonner"
import { FileText, Sparkles, Send, Mail, FilePlus, ExternalLink } from "lucide-react"

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

// Cloud function endpoints. CREATE_DOC_URL needs to be updated once the
// new function is deployed — Firebase usually preserves the project
// hash so the URL is likely
//   https://createritualdoc-b6fhjlgejq-uc.a.run.app
// (mirroring registernewritual-b6fhjlgejq-uc.a.run.app). Confirm in the
// Firebase console after the first deploy and adjust if needed.
const CREATE_DOC_URL =
  "https://createritualdoc-b6fhjlgejq-uc.a.run.app"
const REGISTER_RITUAL_URL =
  "https://registernewritual-b6fhjlgejq-uc.a.run.app"

export default function RegisterRitualPage() {
  // ----- "Create Ritual Doc" state -----
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)

  // ----- "Register New Ritual" state (unchanged) -----
  const [googleDocLink, setGoogleDocLink] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [userInputs, setUserInputs] = useState<string | null>(null)

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError("Email is required")
      return false
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!re.test(value.trim())) {
      setEmailError("Enter a valid email")
      return false
    }
    setEmailError(null)
    return true
  }

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateEmail(email)) return
    setIsCreating(true)
    setCreatedUrl(null)
    try {
      const res = await fetch(CREATE_DOC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (res.ok && data.documentUrl) {
        setCreatedUrl(data.documentUrl)
        toast.success("Ritual doc created", {
          description: `Shared with ${email.trim()} (writer access).`,
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
            Generate a fresh ritual Google Doc from the template and share it with the user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateDoc}>
            <FieldGroup>
              <Field data-invalid={!!emailError}>
                <FieldLabel htmlFor="user-email">
                  <Mail className="h-4 w-4" />
                  User Email
                  <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailError) validateEmail(e.target.value)
                  }}
                  disabled={isCreating}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                />
                {emailError && (
                  <FieldError id="email-error">{emailError}</FieldError>
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
                Doc created and shared. Click below to open it in a new tab,
                fill it in, then copy the URL back into the Register form.
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
