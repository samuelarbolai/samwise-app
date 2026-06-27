# current-plan.md — Document-focused Agent: therapist builds their own Samwise

> **Overwrites the previous plan** ("Onboarding mode in /copilot" — SHIPPED and live as of 2026-06-24).
> **Status: PROPOSAL ONLY. No file edits yet.** Awaiting explicit "go" before any code or Doc is created.
> **Touches three repos:** `samwise-app` (anchor, this file), `samwise-backend/cloud-functions` (synthesizer), `samwise-backend/ritual-agent` (voice-refine — deferred).
> **Spans phases A–F**; only A–D ship in this task. E–F (voice-refine, quick fit test) are explicitly deferred per the user's answers. Canon spec is also deferred — emerges from running the procedure on a real example.
> **Mirror discipline applies** to the surface (mirror `RegisterRitualCard` + the `/for-experts` sidebar view-state pattern) and to the cloud function (mirror `createRitualDoc`'s `drive.files.copy + docs.batchUpdate` pattern verbatim).

## Plan Summary

A therapist who is curious about Samwise can produce their **own custom Samwise script Doc** by feeding the system their framework material (PDF, URL, or pasted text). The flow:

1. Therapist opens `/for-experts` → clicks new sidebar item **"Build custom samwise"** (third sibling to "Copilot" and "Register Ritual"; same view-state pattern, no route change).
2. They either (a) **paste their own framework material** (PDF / URL / textarea) to produce a NEW custom samwise script Doc, OR (b) **paste a previously-generated Doc link** to continue iterating on it (mirrors `/ritual-call`'s doc-link hydration pattern).
3. The "produce a new Doc" path POSTs to a new cloud function `synthesizeCustomScript` (samwise-backend/cloud-functions), which: ingests the framework material, reads the **Samwise Adaptation Procedure Google Doc** (the canonical procedure that defines how to adapt Samwise to any framework), copies the **Samwise Custom Script Template Google Doc** into a parent folder, fills the copy by walking the procedure with Gemini, and returns `{ documentId, documentUrl }`.
4. The therapist gets the Doc link, opens it in Google Docs, edits freely, and can return to `/for-experts` later to re-hydrate by pasting the same link.
5. (Phase E, deferred) — a voice-refine flow in `ritual-agent` walks the therapist through reviewing/refining the draft conversationally, mirroring `ritual-design`.
6. (Phase F, deferred) — a quick fit test surface lets the therapist run their custom script in a copilot-sandbox without recruiting a real patient.

The whole synthesis is anchored on TWO Google Docs the user co-authors with Claude in Phase A:

- **Samwise Adaptation Procedure** — the human-readable procedure that defines: what is canonical Samwise (variables, phases, mandatory beats, vocabulary blacklist) and what is swappable (framework-specific metaphors, exercises, ordering). Lives as a Google Doc so it iterates live without redeploy. The synthesizer reads it on every call via Drive API.
- **Samwise Custom Script Template** — a **funnel-wide manifest Google Doc** with one section per Samwise surface (Qualification prompts / Demo Call / Onboarding / Behavioural-design "Possible Origins" tab spec / Call Design / Daily AI agent prompts). Each section preserves its parent surface's structural conventions verbatim (`[SAY]/[/SAY]` markers, `Phase N — title` headers, `[TYPE: …]` and `[END]` markers, `{{variable}}` slots). The synthesizer `drive.files.copy`'s the manifest for every new therapist, then fills the `[PLACEHOLDERS]` via `docs.batchUpdate`. Mirrors the canonical-template pattern of `createRitualDoc` and `RITUAL_TEMPLATE_DOC_ID` — just bigger. Single Doc keeps v0 simple; therapist gets one link and scrolls.

  **Why funnel-wide, not Demo-only:** real frameworks have components that land at DIFFERENT points in the funnel, not all at Phase 8 of the Demo. Established example (Phase B, CPT): Impact Statement enriches the Qualification capture, Trauma Account replaces the Possible Origins map (Onboarding/behavioural-design), Worksheets land in TWO slots simultaneously (Phase 8 mantra construction AND the Optimization session as a recovery tool). A Demo-only template would have nowhere to put 4 of those 5 placements.

**No new infra primitives.** The synthesizer reuses the cloud-functions module's lazy Google auth singletons (`getDriveClient`, `getDocsClient`), the same `FIREBASE_SERVICE_ACCOUNT` secret, and the same Gemini setup that `cleanVariable` / `extractDemoCall` already use. Three new env vars: `SAMWISE_PROCEDURE_DOC_ID`, `SAMWISE_TEMPLATE_DOC_ID`, `SAMWISE_CUSTOM_PARENT_FOLDER_ID`.

**Aesthetic / UX discipline.** Mirror `RegisterRitualCard` exactly — `<FieldGroup>` / `<Field>` / `<Input>` / `<Textarea>` / `<Button>`, no `<Card>` wrapper, no icon-in-circle. Three input modes selectable via radio (Text / URL / PDF). Single "Build custom samwise script" submit button. Below that, a second `<FieldGroup>` for the "Continue from existing Doc" path: paste link → caches to localStorage (no Drive read needed at this surface — the link itself is the artifact). localStorage caches the last-built Doc URL so a returning therapist sees it on mount.

## Plan Architecture (Flow)

```
                       ┌─────────────────────────────────────────────┐
                       │  /for-experts  page.tsx                     │
                       │  ExpertView = "copilot" | "register"        │
                       │                       | "build-custom" (NEW)│
                       └────┬──────────┬───────────────┬─────────────┘
                            │          │               │
                       copilot     register       build-custom
                            │          │               │
                            │     <RegisterRitual─┐    │
                            │      Card />        │    ▼
                            │                     │  ┌──────────────────────────────────┐
                            │                     │  │ <BuildCustomScriptCard /> (NEW)  │
                            │                     │  │  • Mode: Text | URL | PDF        │
                            │                     │  │  • Submit → POST                 │
                            │                     │  │    synthesizeCustomScript        │
                            │                     │  │  • OR paste existing Doc link    │
                            │                     │  │    → hydrates from localStorage  │
                            │                     │  └──────────┬───────────────────────┘
                            │                     │             │
                            │                     │             ▼
                            │                     │   ┌─────────────────────────────────┐
                            │                     │   │  cloud-functions:               │
                            │                     │   │  synthesizeCustomScript (NEW)   │
                            │                     │   │  1. Extract framework text      │
                            │                     │   │     (PDF → pdf-parse, URL →     │
                            │                     │   │     fetch + readability, text)  │
                            │                     │   │  2. drive.export(               │
                            │                     │   │     SAMWISE_PROCEDURE_DOC_ID)   │
                            │                     │   │  3. drive.files.copy(           │
                            │                     │   │     SAMWISE_TEMPLATE_DOC_ID)    │
                            │                     │   │     → newDocId                  │
                            │                     │   │  4. Gemini fill: walk procedure │
                            │                     │   │     + framework text + template │
                            │                     │   │     → batchUpdate replaceAllText│
                            │                     │   │  5. Return { documentId,        │
                            │                     │   │     documentUrl }               │
                            │                     │   └─────────────────────────────────┘
                            │                     │             │
                            │                     │             ▼
                            │                     │   ┌──────────────────────────────────┐
                            │                     │   │  Per-therapist Samwise Doc       │
                            │                     │   │  (owned by SA, in parent folder, │
                            │                     │   │  Editor-shared to therapist email│
                            │                     │   │  if provided)                    │
                            │                     │   └──────────────────────────────────┘
                            │
                       (existing — unchanged)
```

**Hydration path** (returning therapist):

- Therapist pastes their previously-generated Doc URL into the "Continue from existing Doc" Field on `BuildCustomScriptCard`.
- The card writes it to `localStorage` under `custom-script:last-doc` (mirrors `/ritual-call`'s doc-link hydration), then renders an "Open in Docs" link + (Phase D.3 optional) a "Load into Copilot" button.
- "Load into Copilot" sets `view` back to `"copilot"`, pastes the URL into the URL gate, and triggers the existing `loadCallScript` flow — the custom script renders in `/for-experts` exactly like any other script (it parses `[TYPE: custom]`; for v0 the template carries demo's structural shape so demo-mode rendering falls through cleanly — a `[TYPE: custom]` first-class config router is a Phase F follow-up).

## Plan Structure (Directories and files)

```
samwise-app/
├── current-plan.md                                # THIS FILE
├── app/
│   └── for-experts/
│       └── page.tsx                               # MODIFIED — extend ExpertView union (1 line) + sidebar
│                                                  # item (~8 lines) + view block (1 line) + header label
│                                                  # (1 line). Nothing else in this file moves.
└── components/
    └── build-custom-script-card.tsx               # NEW — self-contained card, mirror of <RegisterRitualCard>'s
                                                  # shape (no Card wrapper, FieldGroup / Field / Input /
                                                  # Textarea / Button only). Owns its own state + fetch.

samwise-backend/
└── cloud-functions/
    └── functions/
        ├── src/
        │   └── index.ts                           # MODIFIED — append `synthesizeCustomScript` export at the
        │                                          # end of the cloud functions list (after extractTrackingKpis
        │                                          # at line ~3216). NO refactor of existing fns; no shared
        │                                          # helper extraction. Mirror createRitualDoc verbatim.
        └── package.json                           # MODIFIED — add `pdf-parse` + `@mozilla/readability` +
                                                  # `jsdom` dependencies. No version bumps elsewhere.

Google Docs (created collaboratively in Phase A, owned by the user):
- Samwise Adaptation Procedure   — id captured in cloud-functions/.env as SAMWISE_PROCEDURE_DOC_ID
- Samwise Custom Script Template — id captured in cloud-functions/.env as SAMWISE_TEMPLATE_DOC_ID

Google Drive folder (created collaboratively in Phase B.4, owned by the user, Editor-shared to the SA):
- "Samwise Custom Scripts" parent folder — id captured in cloud-functions/.env as
  SAMWISE_CUSTOM_PARENT_FOLDER_ID
```

No new env vars on Vercel (samwise-app stays a thin client). All secrets stay in cloud-functions's `.env`. The service account already has Drive/Docs Editor permissions for the existing ritual template/parent — same trust model applies here: the user shares the new template Doc + parent folder with the service account email at the time of creation.

## Modifications (in phases and steps)

### Phase A — The Samwise Adaptation Procedure Doc (collaborative)

**No code in this phase.** I scaffold a Google Doc with section headers and rough content drawn from `samwise-script-work` skill + the existing scripts; the user iterates the wording and decides what is canonical.

**Step A.1 — Create the Google Doc**

- **Where:** Google Drive, sibling of the existing Samwise Ritual Template Doc. Title: `Samwise Adaptation Procedure`.
- **Should NOT be modified:** the existing master Vibe doc (`10PED7oJeRhUqvZTT6ubUFC2QAYMcFkRFpGkPlFmMkgI`) or the Samwise script Docs (Demo, Onboarding, Call Design) — those stay untouched in this phase.
- **Action:** the user creates the Doc, shares the id with me, and shares the Doc with the service account email as Reader. I scaffold the initial content (A.2).

**Step A.2 — Scaffold initial content (I draft, user reviews)**

- **Initial section outline** (content drafted by me, reviewed and tightened by the user before being declared canonical):
  ```
  # Samwise Adaptation Procedure

  ## 0. What this document is
  A repeatable procedure for adapting Samwise to a therapist's existing framework
  (CPT, Brief Strategic, ITAA 12-steps, anything else). Read by humans AND by the
  synthesizeCustomScript cloud function. Edit live — no redeploy required.

  ## 1. What is canonical Samwise (NEVER swap out)
  - The 4-beat call structure (Exit from the day / Entry into the work /
    Intentions / The pact).
  - Variables that must always exist:
      enemy_name, scary_reality, unsettling_reality, behaviour_to_change,
      core_motivation, symbolic_anchor_description, helpers_list, …
    (Full list extracted from samwise-script-work skill — confirm with user.)
  - Mandatory beats: Phase 1.5 reflection, Phase 5b 9-step structure,
    admission-test scarcity beats, the Phase 11 verdict line.
  - Vocabulary blacklist (Rule 7): paciente / comportamiento autodestructivo /
    recaída / terapia → forbidden in spoken text.
  - The mission framing: "help the user decide whether to help themselves."

  ## 2. What is swappable per framework
  - Framework-specific metaphors (CPT's "stuck points", ITAA's "the disease",
    Brief Strategic's "attempted solutions" — pick the framework's own language).
  - The teaching content in Phase 6 (how the framework explains the loop).
  - The exercises in Phase 8 (mantra construction vs. cognitive worksheet vs.
    step-9 amends list vs. paradoxical injunction, depending on framework).
  - The closing reframe in Phase 12 (in the framework's own terms).

  ## 3. The synthesis procedure (what the LLM does, step by step)
  Step 1: Read the framework material. Identify:
    - The framework's name for the problem ("addiction", "stuck pattern", …)
    - The framework's primary metaphor or model
    - The framework's signature exercise or intervention
    - The framework's stance on the user's agency (high / medium / low)
  Step 2: Map each canon variable to the framework's vocabulary.
    - enemy_name → the framework's term for the antagonist
    - scary_reality → the framework's term for the problem state
    - …
  Step 3: For each [PLACEHOLDER] in the Custom Script Template, write a
    framework-specific phrasing that preserves the canon beat's intent.
  Step 4: Sweep for vocabulary blacklist violations (Rule 7) — never let a
    framework's own term reintroduce paciente / recaída / etc. into spoken text.
  Step 5: Output is the FILLED template Doc.

  ## 4. Worked examples (Phase B will fill these by hand)
  ### 4.1 CPT (Cognitive Processing Therapy)
  …filled in Phase B…
  ### 4.2 ITAA 12-steps
  …filled in Phase B…

  ## 5. Hard constraints the LLM must check itself against
  - Did I keep the 4-beat call structure intact? (Y/N)
  - Did I keep every mandatory beat? (Y/N)
  - Did I sweep the spoken text for paciente / recaída / comportamiento
    autodestructivo / terapia? (Y/N)
  - Did I preserve every {{variable}} slot exactly? (Y/N)
  ```
- **Explanation:** §1 is the load-bearing canon list. §5 is what the LLM runs in its head before returning. §4 is empty in Phase A; we fill it during Phase B by doing it manually.

**Step A.3 — Capture the Doc id**

- Doc id goes into `samwise-backend/cloud-functions/.env` (or `firebase functions:secrets:set`) as `SAMWISE_PROCEDURE_DOC_ID`. No code change here — just the env entry; we wire it in Phase C.

### Phase B — Worked example: produce ONE custom script Doc by hand

**No code in this phase.** I (Claude) act as the synthesizer; the user reviews. Picks ONE framework that stress-tests the procedure.

**Step B.1 — Choose the framework**

- I propose three candidates (e.g. **ITAA 12-steps**, **CPT**, **Brief Strategic Therapy**) with a one-line rationale each. User picks one. I fetch source material (a public PDF or URL of canonical framework content).

**Step B.2 — Run the procedure manually**

- I follow §3 of the Adaptation Procedure Doc step by step against the framework material, producing a candidate per-therapist Samwise script DRAFT in a fresh Google Doc.
- The user reviews. We iterate until the draft passes §5's self-checks.
- Anything I had to invent or guess (because the procedure was vague) gets added BACK into the procedure as a sharpening edit — **Phase A's Doc evolves**.

**Step B.3 — Extract the Custom Script Template Doc (manifest-shaped)**

- Once the worked example is solid, I produce the **Samwise Custom Script Template Doc** by stripping framework-specific content out of the worked example and leaving a funnel-wide manifest with ONE Doc-level `[TYPE: custom]` + `[VERSION: 0.1]` + `[END]` boundary, and SECTIONS per Samwise surface. Each section preserves its parent surface's marker conventions verbatim so a downstream parser (or human reader) can still extract the section as a valid script of its parent type.

  ```
  # Samwise Custom Script — Manifest
  [TYPE: custom]
  [VERSION: 0.1]

  ## Section 1 — Qualification prompts
  (capture format + per-variable framework semantics, with [FRAMEWORK_*] placeholders)

  ## Section 2 — Demo Call script
  [TYPE: demo]
  …Phase 1 → Phase 17 with [SAY]/[/SAY] markers, {{variables}} preserved,
  [FRAMEWORK_*] placeholders where framework content goes…
  [END section]

  ## Section 3 — Onboarding script
  [TYPE: onboarding]
  …same shape…
  [END section]

  ## Section 4 — Behavioural-design "Possible Origins" tab spec
  (replaces/extends what the behavioural-design flow captures)

  ## Section 5 — Call Design (Ritual mantras / Protection / Activity)

  ## Section 6 — Daily AI agent prompt (4-beat ritual: Exit / Entry / Intentions / Pact)

  [END]
  ```

- The framework-specific placeholders use a **structural-role-prefixed** name so the synthesizer prompt can reason about placement: `[ROLE_INITIAL_BELIEF_CAPTURE_FORMAT]`, `[ROLE_NARRATIVE_INTEGRATION_FORMAT]`, `[ROLE_COGNITIVE_INTERVENTION_AT_PHASE_8]`, `[ROLE_COGNITIVE_INTERVENTION_AT_OPTIMIZATION]`, `[ROLE_TEACHING_OF_LOOP_AT_PHASE_6]`, `[ROLE_CLOSING_REFRAME_AT_PHASE_12]`, `[ROLE_DAILY_RITUAL_FRAMING]`, `[ROLE_METAPHOR_FOR_ENEMY]`. Same framework component MAY appear at multiple placeholders (CPT's Worksheets fill `[ROLE_COGNITIVE_INTERVENTION_AT_PHASE_8]` AND `[ROLE_COGNITIVE_INTERVENTION_AT_OPTIMIZATION]` with the same source mechanism, formatted differently per slot).
- The four canonical mandatory beats (Phase 1.5 reflection, Phase 5b 9-step, vocabulary-blacklist ☞ guidance, Phase 11 verdict) are preserved verbatim in the Demo section regardless of framework.
- Template Doc id goes into `cloud-functions/.env` as `SAMWISE_TEMPLATE_DOC_ID`.

**Step B.4 — Create the parent Drive folder**

- User creates "Samwise Custom Scripts" folder in their Drive. Shares it Editor with the service account email. Id goes into `cloud-functions/.env` as `SAMWISE_CUSTOM_PARENT_FOLDER_ID`.

### Phase C — The `synthesizeCustomScript` cloud function

**Step C.1 — Add dependencies**

- **In-file location:** `samwise-backend/cloud-functions/functions/package.json`, `dependencies` block.
- **Should NOT be modified:** any existing dep version, `devDependencies`, scripts, engines.
- **Add:**
  ```json
  "pdf-parse": "^1.1.1",
  "@mozilla/readability": "^0.5.0",
  "jsdom": "^24.0.0"
  ```
- **Explanation:** `pdf-parse` extracts text from uploaded PDFs (the therapist's framework material). `@mozilla/readability` + `jsdom` extract the main content from a fetched URL (strips ads/nav, leaves the framework body). Both are battle-tested, no native deps, fast cold-start friendly.

**Step C.2 — Append `synthesizeCustomScript` to `index.ts`**

- **In-file location:** `samwise-backend/cloud-functions/functions/src/index.ts` — APPEND at the end (after `extractTrackingKpis` at line ~3216). Keeps the diff a pure addition; existing functions untouched.
- **Should NOT be modified:** every other `export const ___` in this file. No refactor, no shared-helper extraction. We mirror `createRitualDoc`'s style verbatim.
- **Verify before pasting:** the exact symbol used by `cleanVariable` to get a Gemini client (around line 1693). The placeholder `getGeminiClient` below should be swapped for whatever's actually in `index.ts` (e.g. it may be a local `new GoogleGenerativeAI(API_KEY)` call inline; if so, repeat that inline rather than introducing a new helper).
- **Code:**
  ```ts
  /**
   * synthesizeCustomScript (HTTP)
   *
   * Therapist-facing entrypoint for "Build a custom samwise script."
   * Takes a framework material payload (PDF base64, URL, or pasted text),
   * reads the Samwise Adaptation Procedure Doc, copies the Samwise Custom
   * Script Template Doc, and fills the copy by walking the procedure with
   * Gemini.
   *
   * Mirrors createRitualDoc's drive.copy + docs.batchUpdate pattern.
   *
   * Required env vars:
   *   SAMWISE_PROCEDURE_DOC_ID         — Adaptation Procedure Doc.
   *                                      Must be shared with the SA as Reader.
   *   SAMWISE_TEMPLATE_DOC_ID          — Custom Script Template Doc.
   *                                      Must be shared with the SA as Reader.
   *   SAMWISE_CUSTOM_PARENT_FOLDER_ID  — Drive folder for the copies.
   *                                      Editor-shared to the SA. Operator owns.
   *   GEMINI_KEY                       — already set for cleanVariable
   *                                      (NB: env var name is GEMINI_KEY,
   *                                      not GEMINI_API_KEY — verified
   *                                      against existing call sites).
   */
  export const synthesizeCustomScript = onRequest(
    {cors: true, timeoutSeconds: 540, memory: "1GiB"},
    async (req, res) => {
      if (req.method !== "POST") {
        res.status(405).send({error: "Method Not Allowed"});
        return;
      }

      interface SynthRequest {
        inputMode: "pdf" | "url" | "text";
        pdfBase64?: string;          // when inputMode = "pdf"
        url?: string;                // when inputMode = "url"
        text?: string;               // when inputMode = "text"
        therapistName?: string;      // optional, for doc title
        therapistEmail?: string;     // optional, share Doc as Editor
        frameworkName?: string;      // optional, for doc title + procedure hint
      }

      try {
        const body = req.body as SynthRequest;
        const procedureDocId = process.env.SAMWISE_PROCEDURE_DOC_ID;
        const templateDocId  = process.env.SAMWISE_TEMPLATE_DOC_ID;
        const parentFolderId = process.env.SAMWISE_CUSTOM_PARENT_FOLDER_ID;
        if (!procedureDocId || !templateDocId || !parentFolderId) {
          logger.error("synthesizeCustomScript: missing env config");
          res.status(500).send({error: "Server misconfigured"});
          return;
        }

        // 1. Extract framework text from the chosen input mode.
        let frameworkText = "";
        if (body.inputMode === "pdf" && body.pdfBase64) {
          const pdfParse = (await import("pdf-parse")).default;
          const buffer = Buffer.from(body.pdfBase64, "base64");
          const parsed = await pdfParse(buffer);
          frameworkText = parsed.text;
        } else if (body.inputMode === "url" && body.url) {
          const html = await (await fetch(body.url)).text();
          const {JSDOM} = await import("jsdom");
          const {Readability} = await import("@mozilla/readability");
          const dom = new JSDOM(html, {url: body.url});
          const article = new Readability(dom.window.document).parse();
          frameworkText = article?.textContent ?? html;
        } else if (body.inputMode === "text" && body.text) {
          frameworkText = body.text;
        } else {
          res.status(400).send({error: "Provide pdf, url, or text"});
          return;
        }
        if (frameworkText.trim().length < 200) {
          res.status(400).send({error: "Framework material too short"});
          return;
        }

        // 2. Read the procedure Doc via Drive export (raw text — we
        //    want the full prose, not a parsed-into-phases shape).
        const drive = getDriveClient();
        const procedureExport = await drive.files.export({
          fileId: procedureDocId,
          mimeType: "text/plain",
        }, {responseType: "text"});
        const procedureText = String(procedureExport.data);

        // 3. Copy the template Doc into the parent folder.
        const therapist = body.therapistName?.trim() || "Therapist";
        const framework = body.frameworkName?.trim() || "Custom";
        const docTitle =
          `Samwise — ${therapist} — ${framework} — ` +
          new Date().toISOString().slice(0, 10);
        const copyResp = await drive.files.copy({
          fileId: templateDocId,
          requestBody: {name: docTitle, parents: [parentFolderId]},
          supportsAllDrives: true,
          fields: "id, webViewLink",
        });
        const documentId = copyResp.data.id;
        const documentUrl = copyResp.data.webViewLink ??
          `https://docs.google.com/document/d/${documentId}/edit`;
        if (!documentId) {
          logger.error("synthesizeCustomScript: copy returned no id");
          res.status(500).send({error: "Failed to create doc"});
          return;
        }

        // 4. Read the freshly-copied template's text so Gemini sees
        //    the exact placeholders it needs to fill.
        const tmplExport = await drive.files.export({
          fileId: documentId,
          mimeType: "text/plain",
        }, {responseType: "text"});
        const templateText = String(tmplExport.data);

        // 5. Gemini fill pass. Single round-trip — model returns a
        //    JSON map { placeholder: filledText }. We then
        //    batchUpdate each [PLACEHOLDER] in the Doc. Inline
        //    construction matches the pattern at cleanVariable
        //    (index.ts line ~1716): `new GoogleGenerativeAI(
        //    requireEnv("GEMINI_KEY"))` — no shared helper.
        const gemini = new GoogleGenerativeAI(requireEnv("GEMINI_KEY"));
        const model = gemini.getGenerativeModel({
          model: "gemini-2.5-pro",
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        });
        const prompt = buildSynthesizeCustomScriptPrompt(
          procedureText, templateText, frameworkText, framework
        );
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        const replacements = JSON.parse(raw) as Record<string, string>;

        // 6. batchUpdate replaceAllText for each [PLACEHOLDER].
        const docs = getDocsClient();
        const requests = Object.entries(replacements).map(([key, value]) => ({
          replaceAllText: {
            containsText: {text: `[${key}]`, matchCase: true},
            replaceText: value,
          },
        }));
        if (requests.length > 0) {
          await docs.documents.batchUpdate({
            documentId,
            requestBody: {requests},
          });
        }

        // 7. (Optional) Share with therapist as Editor.
        if (body.therapistEmail) {
          await drive.permissions.create({
            fileId: documentId,
            requestBody: {role: "writer", type: "user",
              emailAddress: body.therapistEmail.trim()},
            sendNotificationEmail: true,
          });
        }

        res.status(200).send({documentId, documentUrl});
      } catch (error) {
        logger.error("synthesizeCustomScript error:", error);
        res.status(500).send({error: "Synthesis failed"});
      }
    }
  );

  function buildSynthesizeCustomScriptPrompt(
    procedureText: string,
    templateText: string,
    frameworkText: string,
    frameworkName: string,
  ): string {
    return `
  You are adapting Samwise to a new therapeutic framework.

  STEP-BY-STEP PROCEDURE (read first; this defines canon vs swappable):
  ${procedureText}

  TARGET FRAMEWORK (read second; this is what we are adapting TO):
  Framework name: ${frameworkName}
  Framework material (full text):
  ${frameworkText}

  TEMPLATE TO FILL (read third; every [PLACEHOLDER_LIKE_THIS] needs a value):
  ${templateText}

  TASK:
  Produce a JSON object mapping every [PLACEHOLDER] in the template to its
  filled value. Only fill PLACEHOLDERS in [SQUARE_BRACKETS]; do NOT touch
  {{double_curly_braces}} — those are runtime variable slots, not synthesis
  placeholders.

  Placeholders are named [ROLE_<STRUCTURAL_ROLE>_AT_<SAMWISE_SLOT>]. A single
  framework component MAY fill multiple placeholders (e.g. CPT Worksheets fill
  both [ROLE_COGNITIVE_INTERVENTION_AT_PHASE_8] and
  [ROLE_COGNITIVE_INTERVENTION_AT_OPTIMIZATION] — same mechanism, different
  formatting per slot). Per the procedure's §2 placement rubric, think across
  the WHOLE funnel: a framework's components may land at different sections
  (Qualification / Demo / Onboarding / Possible Origins / Daily ritual) — not
  all of them belong at Phase 8.

  HARD CONSTRAINTS (from procedure §5):
  - Keep the 4-beat call structure intact.
  - Keep every mandatory beat (Phase 1.5, Phase 5b 9-step, etc.).
  - NEVER write "paciente", "comportamiento autodestructivo", "recaída", or
    "terapia" into spoken text — use the framework's own vocabulary instead.
  - Preserve every {{variable}} slot exactly as written.

  Return ONLY a JSON object of the shape:
    { "PLACEHOLDER_NAME": "filled text", ... }
  No prose, no markdown, no preamble.
  `.trim();
  }
  ```
- **Explanation:** A single self-contained HTTP function that mirrors `createRitualDoc`'s lifecycle (copy → fill → return). Memory bumped to `1GiB` and timeout to `540s` because Gemini-2.5-pro on a long procedure + framework text can take 30–90s. Cold-start tradeoff is acceptable — this is a per-therapist one-shot, not a hot path.

**Step C.3 — Add env vars**

- **Where:** `samwise-backend/cloud-functions/.env` (NEVER committed) — or `firebase functions:secrets:set` depending on which storage cloud-functions currently uses for `RITUAL_TEMPLATE_DOC_ID` etc. **Verify which** before adding.
- **Action:**
  ```
  SAMWISE_PROCEDURE_DOC_ID=<from Phase A.3>
  SAMWISE_TEMPLATE_DOC_ID=<from Phase B.3>
  SAMWISE_CUSTOM_PARENT_FOLDER_ID=<from Phase B.4>
  ```

**Step C.4 — Deploy**

- **Command:** `cd samwise-backend/cloud-functions && firebase deploy --only functions:synthesizeCustomScript`
- **Verify:** the deploy log shows the new function URL. Capture it for Step D.1's `SYNTH_URL` constant.

### Phase D — `BuildCustomScriptCard` + sidebar wiring

**Step D.1 — Create `components/build-custom-script-card.tsx`**

- **In-file location:** new file `samwise-app/components/build-custom-script-card.tsx`.
- **Should NOT be modified:** `components/register-ritual-card.tsx`. Read it for the shape; do NOT extract a shared helper — duplication is fine at v0.
- **Code:**
  ```tsx
  "use client"

  import { useState, useEffect } from "react"
  import {
    FieldGroup,
    Field,
    FieldLabel,
    FieldDescription,
  } from "@/components/ui/field"
  import { Input } from "@/components/ui/input"
  import { Textarea } from "@/components/ui/textarea"
  import { Button } from "@/components/ui/button"
  import { Spinner } from "@/components/ui/spinner"

  const SYNTH_URL =
    "https://synthesizecustomscript-b6fhjlgejq-uc.a.run.app"  // confirm after deploy
  const LAST_DOC_KEY = "custom-script:last-doc"

  type InputMode = "pdf" | "url" | "text"

  export function BuildCustomScriptCard() {
    const [mode, setMode] = useState<InputMode>("text")
    const [text, setText] = useState("")
    const [url, setUrl] = useState("")
    const [pdfBase64, setPdfBase64] = useState<string | null>(null)
    const [therapistName, setTherapistName] = useState("")
    const [therapistEmail, setTherapistEmail] = useState("")
    const [frameworkName, setFrameworkName] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resultUrl, setResultUrl] = useState<string | null>(null)
    const [hydrateUrl, setHydrateUrl] = useState("")

    useEffect(() => {
      const cached = localStorage.getItem(LAST_DOC_KEY)
      if (cached) setResultUrl(cached)
    }, [])

    async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
      const f = e.target.files?.[0]
      if (!f) return
      const buf = await f.arrayBuffer()
      const b64 = btoa(
        new Uint8Array(buf).reduce((s, b) => s + String.fromCharCode(b), "")
      )
      setPdfBase64(b64)
    }

    async function handleSubmit() {
      setLoading(true); setError(null)
      try {
        const body: Record<string, unknown> = {
          inputMode: mode,
          therapistName: therapistName || undefined,
          therapistEmail: therapistEmail || undefined,
          frameworkName: frameworkName || undefined,
        }
        if (mode === "pdf")  body.pdfBase64 = pdfBase64
        if (mode === "url")  body.url = url
        if (mode === "text") body.text = text
        const r = await fetch(SYNTH_URL, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(body),
        })
        if (!r.ok) throw new Error(`Synthesis failed: ${r.status}`)
        const j = await r.json() as {documentUrl: string}
        setResultUrl(j.documentUrl)
        localStorage.setItem(LAST_DOC_KEY, j.documentUrl)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error")
      } finally { setLoading(false) }
    }

    function handleHydrate() {
      if (!hydrateUrl.trim()) return
      localStorage.setItem(LAST_DOC_KEY, hydrateUrl.trim())
      setResultUrl(hydrateUrl.trim())
    }

    return (
      <div className="max-w-2xl space-y-8">
        <FieldGroup>
          <Field>
            <FieldLabel>Framework name (optional)</FieldLabel>
            <Input value={frameworkName} onChange={e => setFrameworkName(e.target.value)} placeholder="CPT, ITAA 12-steps, …" />
          </Field>
          <Field>
            <FieldLabel>Therapist name (optional)</FieldLabel>
            <Input value={therapistName} onChange={e => setTherapistName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Therapist email (optional — shares the Doc as Editor)</FieldLabel>
            <Input type="email" value={therapistEmail} onChange={e => setTherapistEmail(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Input mode</FieldLabel>
            <div className="flex gap-3">
              {(["text","url","pdf"] as InputMode[]).map(m => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={mode===m} onChange={() => setMode(m)} />
                  {m.toUpperCase()}
                </label>
              ))}
            </div>
          </Field>
          {mode === "text" && (
            <Field>
              <FieldLabel>Paste your framework material</FieldLabel>
              <Textarea rows={10} value={text} onChange={e => setText(e.target.value)} />
            </Field>
          )}
          {mode === "url" && (
            <Field>
              <FieldLabel>URL of your framework material</FieldLabel>
              <Input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
            </Field>
          )}
          {mode === "pdf" && (
            <Field>
              <FieldLabel>Upload PDF</FieldLabel>
              <Input type="file" accept="application/pdf" onChange={handlePdfChange} />
            </Field>
          )}
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner /> : "Build custom samwise script"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </FieldGroup>

        {resultUrl && (
          <FieldGroup>
            <Field>
              <FieldLabel>Your custom samwise script Doc</FieldLabel>
              <FieldDescription>
                Click to open in Google Docs. Edit freely; the link is cached locally so you can return to it.
              </FieldDescription>
              <a href={resultUrl} target="_blank" rel="noreferrer" className="text-primary underline break-all">{resultUrl}</a>
            </Field>
          </FieldGroup>
        )}

        <FieldGroup>
          <Field>
            <FieldLabel>Continue from an existing Doc</FieldLabel>
            <FieldDescription>
              Paste the URL of a previously-generated custom samwise Doc to re-hydrate it here.
            </FieldDescription>
            <Input value={hydrateUrl} onChange={e => setHydrateUrl(e.target.value)} placeholder="https://docs.google.com/document/d/…" />
            <Button variant="ghost" onClick={handleHydrate}>Load</Button>
          </Field>
        </FieldGroup>
      </div>
    )
  }
  ```
- **Explanation:** Self-contained, no props. Mirrors `RegisterRitualCard`'s shape: `FieldGroup` / `Field` / `Input` / `Button`, no `<Card>` wrapper. PDF upload reads to a base64 string client-side (cap PDF size to ~5 MB at the upload UI in a hardening pass; v0 trusts the user). Hydration is local-only — the Doc URL is treated as the artifact identifier, no Drive read needed at this surface. The "Load" button stores it to localStorage so the next mount sees it.

**Step D.2 — Wire the sidebar item in `app/for-experts/page.tsx`**

- **In-file location:** `samwise-app/app/for-experts/page.tsx`, FOUR coupled edits:
- **Should NOT be modified:** the entire copilot path (URL gate, `copilotLoaded` derivation, `<CopilotSurface>` mount, all qualify / onboarding wiring), the Register Ritual path, the layout shell, the brand header. Only the four edits below land.
- **Edits:**
  ```tsx
  // (1) Top of file, alongside the other component imports:
  import { BuildCustomScriptCard } from "@/components/build-custom-script-card"

  // (2) Replace the ExpertView union at line 60:
  type ExpertView = "copilot" | "register" | "build-custom"

  // (3) Inside the <SidebarMenu>, after the "Register Ritual"
  //     SidebarMenuItem (after line ~183):
  <SidebarMenuItem>
    <SidebarMenuButton
      isActive={view === "build-custom"}
      onClick={() => setView("build-custom")}
      tooltip="Build custom samwise script"
    >
      <span>Build custom samwise</span>
    </SidebarMenuButton>
  </SidebarMenuItem>

  // (4) In the render block, after the line
  //     `{view === "register" && <RegisterRitualCard />}` (line ~273):
  {view === "build-custom" && <BuildCustomScriptCard />}

  // (5) In the header h1 label resolver (around line ~199, currently a
  //     ternary like `view === "copilot" ? "Copilot for behavioural experts" : "Register Ritual"`),
  //     extend to:
  //       view === "copilot"  ? "Copilot for behavioural experts"
  //     : view === "register" ? "Register Ritual"
  //     : "Build custom samwise"
  ```
- **Explanation:** Pure additions in the existing view-state machine. No URL change, no route added. The new view is one click away from Copilot — when the therapist has built their script, they switch back to Copilot, paste the new Doc URL into the existing gate, and the existing `loadCallScript` flow handles it.

**Step D.3 (optional, can ship in a follow-up) — "Load into Copilot" affordance**

- Add a `<Button onClick={() => { /* setView('copilot'); seed URL gate */ }}>Load into Copilot</Button>` inside the `resultUrl` `FieldGroup`. Requires lifting `setView` + a one-shot URL seed prop into `BuildCustomScriptCard` (or via a tiny context). **Skip in v0** — paste-into-gate works fine.

### Phase E — Voice-refine flow (DEFERRED — outline only)

A new sibling flow `flows/custom-script-design/` in `samwise-backend/ritual-agent/`, mirroring `flows/ritual-design/`. The therapist talks to the agent, the agent reads the just-generated custom script Doc, and the therapist refines specific phases conversationally. Same Aragorn persona, same `readGoogleDoc` / `writeToDocTab` infra (per the `ritual-design-prompt` skill). Surface in samwise-app: a "Refine via voice" button on `BuildCustomScriptCard` once `resultUrl` is set.

**Not in scope for this task.** Documented here so the architecture stays consistent.

### Phase F — Quick fit test + first-class `[TYPE: custom]` config (DEFERRED — outline only)

A `/for-experts/custom-script-test` sub-view (or a fourth sidebar item) that loads the therapist's custom script into a sandbox copilot with a simulated patient (LLM plays the patient end-to-end) so the therapist can feel the call without recruiting. ALSO: add `custom` to the `configForScriptType()` router in `app/for-experts/page.tsx` so `[TYPE: custom]` scripts get their own variable config + UI instead of falling through to demo.

**Not in scope for this task.**

## Testing phase

### Local test

- **Phase A:** Doc is reviewable in Google Docs. No code to run.
- **Phase B:** Worked example Doc + template Doc are reviewable. No code to run.
- **Phase C:**
  - `cd samwise-backend/cloud-functions/functions && pnpm tsc --noEmit` — type-check.
  - `pnpm lint` — lint clean.
  - `firebase emulators:start --only functions` — start emulator.
  - Hit the local emulator URL with `curl` (text mode, short payload) — verify it returns `{ documentId, documentUrl }` and that the resulting Doc has every `[PLACEHOLDER]` substituted (open in Google Docs, Ctrl+F for `[` — should find only `[SAY]`/`[/SAY]`/`[END]`/`[TYPE: ...]`/`[VERSION: ...]` markers).
- **Phase D:**
  - `cd samwise-app && pnpm dev` — start dev server.
  - Open `http://localhost:3000/for-experts` → sidebar "Build custom samwise" → fill text mode with ~500 words of CPT material → Submit → verify Doc URL appears.
  - Hard-reload → URL is still visible (localStorage hydration works).
  - Paste a different Doc URL into "Continue from existing Doc" → click Load → verify `resultUrl` swaps.

### Integration test

- Deploy `synthesizeCustomScript` to the production Firebase project.
- Update `SYNTH_URL` in `build-custom-script-card.tsx` to the deployed URL.
- From localhost samwise-app, submit a real PDF (e.g. an ITAA 12-step pamphlet) → verify the resulting Doc renders in Google Docs with: the framework's vocabulary present in spoken text, Samwise canon vocabulary preserved, vocabulary blacklist respected (Ctrl+F for `paciente` / `recaída` / `comportamiento autodestructivo` / `terapia` inside `[SAY]…[/SAY]` blocks — must return 0 hits).
- Switch back to "Copilot" view → paste the new Doc URL into the gate → `loadCallScript` returns the parsed shape → renders in script-pane without errors. (Variable substitution may be sparse since the custom script's `{{variables}}` may not be in `demo-call-config.ts` — acceptable for v0.)

### Update README

- **samwise-backend/cloud-functions/functions/src/index.ts:** add `synthesizeCustomScript` to the top-of-file function index comment (line ~53).
- **samwise-app:** no README update (the app doesn't have a feature-list README).

## After implementation

- Update `samwise-app/context-for-code-agent.md`:
  - Add `/for-experts` "Build custom samwise" view to the route description.
  - Note the new `BuildCustomScriptCard` component.
  - Note the new cloud function `synthesizeCustomScript` and its three env vars.
  - Note the localStorage key `custom-script:last-doc`.
- Update `samwise-backend/cloud-functions/functions/src/index.ts`'s top-of-file comment to include `synthesizeCustomScript` in the function list.
- (Manual user step) Mark the task DONE → FINISHED in the master Vibe doc Projects tab once Phases A–D ship. Phases E–F either remain IN PROGRESS as separate task entries or get spun off as new tasks.
- (Skill update) Append a section to the `samwise-session-copilot` skill describing the "Build custom samwise" view and the `[TYPE: custom]` script-type fall-through behaviour. Add a new skill (or section in `samwise-script-work`) describing the **Samwise Adaptation Procedure Doc** as the source of truth for "what is canon."
