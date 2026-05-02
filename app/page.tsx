"use client"

import { useState } from "react"
import { toast } from "sonner"
import { FileText, Sparkles, Send } from "lucide-react"

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

export default function RegisterRitualPage() {
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

    if (!validateLink(googleDocLink)) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(
        "https://registernewritual-b6fhjlgejq-uc.a.run.app",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            googleDocLink: googleDocLink.trim(),
          }),
        }
      )

      const data = await response.json()

      if (response.ok) {
        toast.success("Ritual Registered!", {
          description: data.message || "Your ritual has been successfully registered.",
        })
        if (data.userInputs) {
          setUserInputs(data.userInputs)
        }
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
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
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
                {linkError && <FieldError id="link-error">{linkError}</FieldError>}
              </Field>

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={isLoading}
              >
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
