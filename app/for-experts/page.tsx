"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { FileText, Send, Headphones, Sparkles, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field"
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
import { RegisterRitualCard } from "@/components/register-ritual-card"
import { BuildCustomScriptCard } from "@/components/build-custom/build-custom-script-card"

import {
  DEFAULT_DEMO_SCRIPT_DOC_URL,
  DEMO_CALL_VARIABLES,
  type DemoCallVariable,
} from "./demo-call-config"
import {
  DEFAULT_ONBOARDING_SCRIPT_DOC_URL,
  ONBOARDING_VARIABLES,
} from "./onboarding-call-config"
import {
  loadCallScript,
  loadCustomScript,
  type LoadedScript,
} from "@/lib/copilot/load-script"
import {
  loadSessionState,
  type SessionState,
  makeEmptyState,
} from "@/lib/copilot/session-storage"
import { CopilotSurface } from "./copilot-surface"
import { QualifyPrefillRow } from "./qualify-prefill-row"
import { OnboardingPrefillRow } from "./onboarding-prefill-row"
import { OnboardingSaveRow } from "./onboarding-save-row"

// Map scriptType → the variable set + which mode-specific UI the
// post-load surface should mount. Adding a third mode (call_design)
// is a config addition + a new entry here — no other plumbing.
function configForScriptType(
  scriptType: LoadedScript["scriptType"],
): { variables: DemoCallVariable[]; mode: "demo" | "onboarding" } | null {
  if (scriptType === "demo") return { variables: DEMO_CALL_VARIABLES, mode: "demo" }
  if (scriptType === "onboarding")
    return { variables: ONBOARDING_VARIABLES, mode: "onboarding" }
  // Therapist-built custom scripts (post-2026-06-28 Firestore path).
  // v1 reuses the demo variable set so the script + variables panes
  // render — the therapist is reading the script, not running a real
  // call, so {{variable}} slots show as "Not filled by user" and the
  // [SAY] blocks are visible for review.
  if (scriptType === "custom")
    return { variables: DEMO_CALL_VARIABLES, mode: "demo" }
  return null
}

type ExpertView = "copilot" | "register" | "build-custom"

export default function ForExpertsPage() {
  const [view, setView] = useState<ExpertView>("copilot")
  const [docUrl, setDocUrl] = useState(DEFAULT_DEMO_SCRIPT_DOC_URL)
  const [isLoading, setIsLoading] = useState(false)
  const [script, setScript] = useState<LoadedScript | null>(null)
  const [state, setState] = useState<SessionState | null>(null)

  // Restore last session on mount if one exists in localStorage.
  // Also handles the "Load in Copilot to test" handoff from the
  // Build custom samwise editor: if copilot:pending-script-id is set,
  // fetch and mount that custom script as the active session.
  useEffect(() => {
    const pendingScriptId = localStorage.getItem("copilot:pending-script-id")
    if (pendingScriptId) {
      localStorage.removeItem("copilot:pending-script-id")
      setView("copilot")
      setIsLoading(true)
      loadCustomScript(pendingScriptId)
        .then((loaded) => {
          const cfg = configForScriptType(loaded.scriptType)
          if (!cfg) {
            toast.error(`Unsupported scriptType: ${loaded.scriptType}`)
            return
          }
          setScript(loaded)
          setState(makeEmptyState(cfg.variables))
          toast.success("Custom script loaded", {
            description: `${loaded.phases.length} phases · scriptType=${loaded.scriptType}.`,
          })
        })
        .catch((err) => {
          toast.error("Could not load custom script", {
            description: err instanceof Error ? err.message : "Unknown error.",
          })
        })
        .finally(() => setIsLoading(false))
      return
    }
    const restored = loadSessionState()
    if (restored) {
      setScript(restored.script)
      setState(restored.state)
      setDocUrl(restored.docUrl)
    }
  }, [])

  const handleLoad = async () => {
    if (!docUrl.trim()) return
    setIsLoading(true)
    try {
      const loaded = await loadCallScript(docUrl.trim())
      const config = configForScriptType(loaded.scriptType)
      if (!config) {
        toast.error(`Unsupported scriptType: "${loaded.scriptType}"`, {
          description:
            'Supported in v1: "demo", "onboarding". Pick a different Doc.',
        })
        return
      }
      setScript(loaded)
      setState(makeEmptyState(config.variables))
      toast.success("Script loaded", {
        description: `${loaded.phases.length} phases · scriptType=${loaded.scriptType}.`,
      })
    } catch (err) {
      toast.error("Could not load script", {
        description: err instanceof Error ? err.message : "Unknown error.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Sidebar shell is the persistent frame. All views (Copilot URL gate,
  // loaded Copilot surface, Register Ritual, Build custom samwise) render
  // INSIDE it so the sidebar is always reachable. The copilot used to
  // take over the full viewport on load; that was removed 2026-06-26 per
  // user request — sidebar nav must stay one click away even mid-call.
  const copilotLoaded = view === "copilot" && script && state
  const config = copilotLoaded ? configForScriptType(script!.scriptType) : null

  return (
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
            <SidebarGroupLabel>Tools</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={view === "copilot"}
                    onClick={() => setView("copilot")}
                    tooltip="Copilot"
                  >
                    <Headphones className="h-4 w-4" />
                    <span>Copilot</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={view === "register"}
                    onClick={() => setView("register")}
                    tooltip="Register Ritual"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Register Ritual</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={view === "build-custom"}
                    onClick={() => setView("build-custom")}
                    tooltip="Build custom samwise script"
                  >
                    <Wand2 className="h-4 w-4" />
                    <span>Build custom samwise</span>
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
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
          <SidebarTrigger />
          <h1 className="text-sm font-medium">
            {view === "copilot" ? (
              <>
                Copilot{" "}
                <span className="text-muted-foreground font-normal">
                  for behavioural experts
                </span>
              </>
            ) : view === "register" ? (
              "Register Ritual"
            ) : (
              <>
                Build custom samwise{" "}
                <span className="text-muted-foreground font-normal">
                  · adapt to your framework
                </span>
              </>
            )}
          </h1>
        </header>

        <main
          className={
            copilotLoaded || view === "build-custom"
              ? "flex flex-1 flex-col"
              : "flex flex-1 flex-col items-center justify-start p-4 py-12"
          }
        >
          {view === "copilot" && copilotLoaded && config && (
            <CopilotSurface
              variables={config.variables}
              state={state!}
              setState={setState}
              docUrl={docUrl}
              script={script!}
              topSlot={
                config.mode === "onboarding" ? (
                  <OnboardingPrefillRow script={script!} setState={setState} />
                ) : (
                  <QualifyPrefillRow script={script!} setState={setState} />
                )
              }
              saveOverride={
                config.mode === "onboarding" ? (
                  <OnboardingSaveRow state={state!} variables={config.variables} />
                ) : undefined
              }
            />
          )}

          {view === "copilot" && copilotLoaded && !config && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Unsupported scriptType: {script!.scriptType}
            </p>
          )}

          {view === "copilot" && !copilotLoaded && (
            <div className="w-full max-w-lg">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="doc-url">
                    <FileText className="h-4 w-4" />
                    Script Google Doc URL
                  </FieldLabel>
                  <Input
                    id="doc-url"
                    type="url"
                    placeholder="https://docs.google.com/document/d/..."
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    disabled={isLoading}
                  />
                </Field>
                <div className="flex gap-2 -mt-1 flex-wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDocUrl(DEFAULT_DEMO_SCRIPT_DOC_URL)}
                    disabled={isLoading}
                    className="h-7 text-xs"
                  >
                    Demo default
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDocUrl(DEFAULT_ONBOARDING_SCRIPT_DOC_URL)}
                    disabled={isLoading}
                    className="h-7 text-xs"
                  >
                    Onboarding default
                  </Button>
                </div>
                <Button
                  onClick={handleLoad}
                  disabled={isLoading}
                  className="w-full mt-2"
                >
                  {isLoading ? (
                    <>
                      <Spinner className="mr-2" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Load script
                    </>
                  )}
                </Button>
              </FieldGroup>
            </div>
          )}

          {view === "register" && <RegisterRitualCard />}

          {view === "build-custom" && <BuildCustomScriptCard />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
