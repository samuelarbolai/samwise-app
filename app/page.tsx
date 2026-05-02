"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { FileText, Sparkles, Send, Settings, Save, Check, Expand } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  FieldDescription,
  FieldError,
  FieldGroup,
} from "@/components/ui/field"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

const DEFAULT_PROMPT_KEY = "ritual-default-prompt"

export default function RegisterRitualPage() {
  const [googleDocLink, setGoogleDocLink] = useState("")
  const [geminiPrompt, setGeminiPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [defaultPrompt, setDefaultPrompt] = useState("")
  const [defaultPromptInput, setDefaultPromptInput] = useState("")
  const [showSaved, setShowSaved] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [userInputs, setUserInputs] = useState<string | null>(null)
  const [expandedField, setExpandedField] = useState<"gemini" | "default" | null>(null)
  const [modalValue, setModalValue] = useState("")

  // Load default prompt from local storage on mount
  useEffect(() => {
    setIsMounted(true)
    const stored = localStorage.getItem(DEFAULT_PROMPT_KEY)
    if (stored) {
      setDefaultPrompt(stored)
      setDefaultPromptInput(stored)
    }
  }, [])

  const openExpandedEditor = (field: "gemini" | "default") => {
    setExpandedField(field)
    setModalValue(field === "gemini" ? geminiPrompt : defaultPromptInput)
  }

  const closeExpandedEditor = () => {
    if (expandedField === "gemini") {
      setGeminiPrompt(modalValue)
    } else if (expandedField === "default") {
      setDefaultPromptInput(modalValue)
    }
    setExpandedField(null)
  }

  const saveDefaultPrompt = () => {
    const trimmed = defaultPromptInput.trim()
    localStorage.setItem(DEFAULT_PROMPT_KEY, trimmed)
    setDefaultPrompt(trimmed)
    setShowSaved(true)
    setTimeout(() => setShowSaved(false), 2000)
    toast.success("Default Prompt Saved", {
      description: trimmed ? "Your default prompt has been saved." : "Default prompt cleared.",
    })
  }

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
            geminiPrompt: geminiPrompt.trim() || defaultPrompt,
          }),
        }
      )

      const data = await response.json()

      if (response.ok) {
        toast.success("Ritual Registered!", {
          description: data.message || "Your ritual has been successfully registered.",
        })
        // Store userInputs from response
        if (data.userInputs) {
          setUserInputs(data.userInputs)
        }
        // Reset form on success
        setGoogleDocLink("")
        setGeminiPrompt("")
      } else {
        // API returns errors as { error: "<message>" }
        toast.error("Registration Failed", {
          description: data.error || "Something went wrong. Please try again.",
        })
      }
    } catch (error) {
      // Network errors or JSON parsing errors
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
            Connect your Google Doc and optionally customize the Gemini prompt
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

              <Field>
                <FieldLabel htmlFor="gemini-prompt">
                  <Sparkles className="h-4 w-4" />
                  Gemini Prompt
                  <span className="text-muted-foreground text-xs font-normal ml-1">
                    (Optional)
                  </span>
                </FieldLabel>
                <FieldDescription>
                  Customize how Gemini processes your document.
                  {isMounted && defaultPrompt && !geminiPrompt.trim() && (
                    <span className="text-primary"> Using default prompt.</span>
                  )}
                </FieldDescription>
                <div className="relative">
                  <Textarea
                    id="gemini-prompt"
                    placeholder={isMounted && defaultPrompt ? defaultPrompt : "Enter your custom prompt here..."}
                    value={geminiPrompt}
                    onChange={(e) => setGeminiPrompt(e.target.value)}
                    disabled={isLoading}
                    rows={4}
                    className="resize-none pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => openExpandedEditor("gemini")}
                    disabled={isLoading}
                  >
                    <Expand className="h-4 w-4" />
                    <span className="sr-only">Expand editor</span>
                  </Button>
                </div>
              </Field>

              {/* Default Prompt Section */}
              <div className="border-t pt-4 mt-2">
                <Field>
                  <FieldLabel htmlFor="default-prompt">
                    <Settings className="h-4 w-4" />
                    Default Prompt
                  </FieldLabel>
                  <FieldDescription>
                    This prompt will be used when the Gemini Prompt field above is empty
                  </FieldDescription>
                  <div className="relative">
                    <Textarea
                      id="default-prompt"
                      placeholder="Set a default prompt to use automatically..."
                      value={defaultPromptInput}
                      onChange={(e) => setDefaultPromptInput(e.target.value)}
                      disabled={isLoading}
                      rows={3}
                      className="resize-y pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => openExpandedEditor("default")}
                      disabled={isLoading}
                    >
                      <Expand className="h-4 w-4" />
                      <span className="sr-only">Expand editor</span>
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={saveDefaultPrompt}
                    disabled={isLoading || (isMounted && defaultPromptInput === defaultPrompt)}
                    className="mt-2"
                  >
                    {showSaved ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Default
                      </>
                    )}
                  </Button>
                </Field>
              </div>

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

          {/* User Inputs Response Block */}
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

      {/* Expanded Editor Modal */}
      <Dialog open={expandedField !== null} onOpenChange={(open) => !open && closeExpandedEditor()}>
        <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {expandedField === "gemini" ? "Edit Gemini Prompt" : "Edit Default Prompt"}
            </DialogTitle>
          </DialogHeader>
          <Textarea
            value={modalValue}
            onChange={(e) => setModalValue(e.target.value)}
            className="flex-1 resize-none min-h-0"
            placeholder={
              expandedField === "gemini"
                ? "Enter your custom prompt here..."
                : "Set a default prompt to use automatically..."
            }
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpandedField(null)}>
              Cancel
            </Button>
            <Button onClick={closeExpandedEditor}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
