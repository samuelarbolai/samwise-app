# current-plan.md — Create Ritual Doc feature

## Plan Summary
Add a "Create Ritual Doc" section to `samwise-app/app/page.tsx` that lets an operator generate a fresh ritual Google Doc from a canonical template, without leaving the app. Operator types an email → backend copies the template doc into a shared Drive folder we own → shares the copy with the email (writer access) → returns the new doc's URL. UI shows the URL with an "Open Doc" button. Operator opens the doc, fills it in, copies the URL back, and pastes it into the existing "Register New Ritual" form below to ship it.

Decisions confirmed by the user (2026-05-06):
- **(1a)** Copy from a canonical template Google Doc — needs a `RITUAL_TEMPLATE_DOC_ID` env var pointing at it.
- **(2c)** Service account creates the copy AND places it inside a Drive folder we own — needs a `RITUAL_PARENT_FOLDER_ID` env var. Service account is the OWNER; user gets writer access via a permission grant.
- **(3a)** UI shows the URL with "Open Doc" button. NO auto-fill into the existing Register input — the operator opens the doc, fills it, copies the URL back manually, then registers.

The backend lives as a new Firebase cloud function `createRitualDoc` next to `registerNewRitual`, reusing the existing service-account `googleapis` client (`getDriveClient()`). No new credentials. No Firestore writes from this function — it only touches Drive.

## Plan Architecture (Flow)
```
samwise-app (browser)
       │  POST { email, title? }
       ▼
createRitualDoc (Firebase Function, us-central1)
       │
       ├── drive.files.copy({ fileId: TEMPLATE_DOC_ID,
       │                       resource: { name: title, parents: [PARENT_FOLDER_ID] } })
       │
       ├── drive.permissions.create({ fileId: <new doc id>,
       │                               resource: { role: 'writer', type: 'user', emailAddress: email },
       │                               sendNotificationEmail: true })
       │
       └── return { documentId, documentUrl }
                                ▲
                                │
                          UI shows URL + "Open Doc" button (target=_blank)
```

The function is independent of `registerNewRitual` — they share `getDriveClient()` and the service-account credentials but don't call each other. After the operator fills the doc and pastes the URL into the existing Register form, the existing flow takes over.

## Plan Structure (Directories and files)

```
samwise-app/
├── app/
│   └── page.tsx                                # ADDED: "Create Ritual Doc" Card above the existing Register Card
└── components/ui/                              # NO CHANGES — reuse existing shadcn primitives

samwise-backend/cloud-functions/functions/
├── src/
│   └── index.ts                                # ADDED: `createRitualDoc` onRequest handler
├── .env or environment config                  # ADDED: RITUAL_TEMPLATE_DOC_ID, RITUAL_PARENT_FOLDER_ID
```

## One-time setup (operator does this manually before testing)

These two Drive resources need to exist before the function works. Skip if they already exist; otherwise:

1. **Create the canonical ritual template Google Doc.** Open Drive → New → Google Docs. Title it something like "Samwise Ritual Template". Build the structure following `samwise-backend/cloud-functions/functions/src/google-doc-template.md` (Metadata tab keys + section placeholders). Share it with the service-account email (the one in `GOOGLE_APPLICATION_CREDENTIALS`) as a Reader so the function can read it during the copy operation.
2. **Create the parent Drive folder.** New → Folder, name it (e.g. "Samwise Rituals"). Share it with the service-account email as an Editor so the function can place new docs inside.
3. Note the doc ID (the long string in the doc URL) and folder ID (same in the folder URL). These become the env values in step Phase 1 below.

## Modifications (in phases and steps)

### Phase 1 / Step 1 — Add env vars to cloud-functions

- **In-file location:** `samwise-backend/cloud-functions/functions/.env` (or the equivalent Firebase Functions config the project already uses — check existing pattern with `GEMINI_KEY`).
- **Should not be modified:** the existing env vars (`GEMINI_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, etc.).
- **Code:**
  ```
  RITUAL_TEMPLATE_DOC_ID=<paste template doc ID from setup step 1>
  RITUAL_PARENT_FOLDER_ID=<paste parent folder ID from setup step 2>
  ```
- **Explanation:** Two new env vars consumed by the new function only. The same `GOOGLE_APPLICATION_CREDENTIALS` service account that already works with `getDriveClient()` for `registerNewRitual`'s title fetch is the one we use to copy + share — no new credentials.

### Phase 1 / Step 2 — Add `createRitualDoc` cloud function

- **In-file location:** `samwise-backend/cloud-functions/functions/src/index.ts`. Append at the bottom of the file, after the existing `registerNewRitual` export, before any final closing braces.
- **Should not be modified:**
  - `registerNewRitual` and its helpers (`getDriveClient`, `upsertUserDoc`, `RitualData` interface).
  - Any of the imports at the top — the new function uses what's already imported (`onRequest`, `cors`, `logger`, `getDriveClient`).
- **Code:**
  ```ts
  /**
   * createRitualDoc — POST { email: string, title?: string } →
   * 1. Copy the canonical ritual template Google Doc into our shared
   *    folder. The service account becomes the OWNER of the copy.
   * 2. Grant the requesting email writer access via a permission so
   *    they can fill the doc out.
   * 3. Return { documentId, documentUrl } for the UI to display.
   *
   * No Firestore writes here. The operator pastes the returned URL
   * into the existing "Register New Ritual" form once the doc is
   * filled, and `registerNewRitual` then takes over.
   */
  export const createRitualDoc = onRequest(
    { region: "us-central1", cors: true },
    async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).send({error: "Method Not Allowed"});
        return;
      }

      interface CreateDocRequest {
        email: string;
        title?: string;
      }

      try {
        const {email, title} = req.body as CreateDocRequest;

        if (!email || typeof email !== "string") {
          res.status(400).send({error: "Missing email"});
          return;
        }
        // Cheap email format check; Drive's permission API will hard-
        // fail on invalid addresses anyway, but a clean 400 is better
        // UX than relying on the upstream error.
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          res.status(400).send({error: "Invalid email format"});
          return;
        }

        const templateId = process.env.RITUAL_TEMPLATE_DOC_ID;
        const parentFolderId = process.env.RITUAL_PARENT_FOLDER_ID;
        if (!templateId || !parentFolderId) {
          logger.error(
            "createRitualDoc: missing RITUAL_TEMPLATE_DOC_ID or " +
            "RITUAL_PARENT_FOLDER_ID env vars"
          );
          res.status(500).send({error: "Server misconfigured"});
          return;
        }

        // Default title makes the doc findable in Drive. Operator can
        // rename inside Google Docs anytime; the registration flow
        // re-reads the title via Drive API, so renames flow through.
        const docTitle =
          title?.trim() ||
          `Samwise Ritual — ${email.trim()} — ` +
          new Date().toISOString().slice(0, 10);

        const drive = getDriveClient();

        // 1. Copy the template into the parent folder. `parents` here
        //    moves the new file into our owned folder rather than the
        //    service account's root.
        const copyResp = await drive.files.copy({
          fileId: templateId,
          requestBody: {
            name: docTitle,
            parents: [parentFolderId],
          },
          supportsAllDrives: true,
          fields: "id, webViewLink",
        });

        const documentId = copyResp.data.id;
        const documentUrl =
          copyResp.data.webViewLink ??
          `https://docs.google.com/document/d/${documentId}/edit`;

        if (!documentId) {
          logger.error("createRitualDoc: Drive copy returned no id");
          res.status(500).send({error: "Failed to create doc"});
          return;
        }

        // 2. Share with the operator's email as Writer. Notification
        //    email gives them a Drive invite they can click into.
        await drive.permissions.create({
          fileId: documentId,
          sendNotificationEmail: true,
          requestBody: {
            role: "writer",
            type: "user",
            emailAddress: email.trim(),
          },
          supportsAllDrives: true,
        });

        logger.info(
          `createRitualDoc: created ${documentId} for ${email}`
        );
        res.status(200).send({
          message: "Ritual doc created",
          documentId,
          documentUrl,
        });
      } catch (error) {
        logger.error("createRitualDoc: unexpected error", error);
        res.status(500).send({error: "Internal Server Error"});
      }
    }
  );
  ```
- **Explanation:** The function is a thin wrapper around two Drive API calls: copy + permissions.create. Re-uses `getDriveClient()` so the auth picture is identical to `registerNewRitual`'s title fetch. No Firestore touch — keeps the function single-purpose. The catch-all error returns 500 with a generic message; specific Drive errors are still in `logger.error` for the operator to inspect.

### Phase 2 / Step 1 — Add the "Create Ritual Doc" Card to samwise-app

- **In-file location:** `samwise-app/app/page.tsx`. Insert a new Card above the existing "Register New Ritual" Card; keep the page as a single page with two stacked Cards.
- **Should not be modified:**
  - The existing "Register New Ritual" Card and its `handleSubmit` — leave that flow untouched. The two flows are independent; per decision (3a) we don't auto-fill.
  - The shadcn imports already at the top — extend them by adding new icon imports if needed.
- **Code (replace the entire file):**
  ```tsx
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

  // Replace the URL with the deployed cloud function URL once Phase 1
  // ships. Mirrors the pattern used by REGISTER_RITUAL_URL below.
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
  ```
- **Explanation:** Two stacked Cards on the same page. Top Card is the new feature; bottom Card is the existing Register flow, untouched in behavior (only re-typeset to live alongside the new one). The new flow's success state shows an "Open Doc" button + the raw URL (so the operator can copy/paste). Per decision (3a) we deliberately don't autofill the Register input — the operator opens the doc, fills it, and pastes the URL manually.

### Testing phase

- **Local test (Phase 1, cloud function):**
  1. Set `RITUAL_TEMPLATE_DOC_ID` and `RITUAL_PARENT_FOLDER_ID` in the local Firebase emulator config (or a `.env` consumed by `firebase emulators:start --only functions`).
  2. From a terminal: `curl -X POST http://localhost:5001/<project>/us-central1/createRitualDoc -H 'Content-Type: application/json' -d '{"email":"yourself@example.com"}'`
  3. Expect `{ message, documentId, documentUrl }`. Open `documentUrl` and confirm the new doc is a copy of the template, lives inside the parent folder, and is shared with `yourself@example.com` as Editor (writer).
- **Local test (Phase 2, samwise-app):**
  1. `pnpm dev` from `samwise-app/`.
  2. Visit `http://localhost:3000`. Top card "Create Ritual Doc" appears.
  3. Type email, click Create Doc. While dev'ing locally, the function URL constant must point at the deployed function (or a tunnel) — local cloud-functions emulator can be wired in by changing `CREATE_DOC_URL` to `http://localhost:5001/...`.
  4. Click "Open Doc" — new tab loads the doc with full edit access for the email.
- **Integration test (after both phases deployed):**
  1. Operator types their own email in the Create Doc Card → click Create.
  2. Toast confirms creation. "Open Doc" button appears.
  3. Operator clicks Open Doc, fills in the Metadata tab + content following the template.
  4. Operator copies the doc URL, pastes it into the Register Card below, clicks Register Ritual.
  5. Expected: same `registerNewRitual` flow as today — Firestore `rituals/{auto-id}` and `users/{userID}` get created/updated; UI shows the synthesized `userInputs` block.
- **Update README:** N/A for samwise-app (no README today). For cloud-functions, append a one-line note in `samwise-backend/cloud-functions/functions/README.md` (if present) listing `createRitualDoc` alongside `registerNewRitual`. Skip if no such README exists.

### After implementation

- **Update `context-for-code-agent.md`:**
  - In samwise-app's: add a note under "Conventions" mentioning the two cloud-function URLs the page calls (CREATE_DOC_URL, REGISTER_RITUAL_URL) and the convention to keep them as top-of-file constants.
  - In `samwise-backend/cloud-functions/functions/src/context-for-code-agent.md` (if maintained): add a short section listing `createRitualDoc` and the two new env vars.
- **Mark the task DONE in master Vibe doc Projects tab** (manual user step).
