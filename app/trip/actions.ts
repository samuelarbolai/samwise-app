"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/firebase-admin";
import {
  ensureSheetTab,
  getServiceAccountEmail,
  writeSheetValues,
} from "@/lib/google-sheets";
import {
  SEED_BUDGET,
  SEED_CONTINGENCIES,
  SEED_DAILY_PLANS,
  SEED_EVENTS,
  SEED_PACKING,
  SEED_ROUTES,
  SEED_TODOS,
} from "./_seed";
import type {
  BudgetLine,
  ContingencyCard,
  DailyPlan,
  EventItem,
  PackingItem,
  PreTripTodo,
  RouteBlueprint,
  SpendEntry,
  WorkspaceMeta,
} from "./_types";

function workspaceRef(token: string) {
  if (!/^[a-z2-9]{6,40}$/.test(token)) {
    throw new Error(`Invalid trip workspace token: ${token}`);
  }
  return getDb().collection("tripWorkspaces").doc(token);
}

function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const inFlightTripSeed = new Map<string, Promise<void>>();

export async function ensureTripWorkspace(token: string): Promise<void> {
  if (inFlightTripSeed.has(token)) return inFlightTripSeed.get(token);
  const p = doEnsureTripWorkspace(token).finally(() =>
    inFlightTripSeed.delete(token),
  );
  inFlightTripSeed.set(token, p);
  return p;
}

async function doEnsureTripWorkspace(token: string): Promise<void> {
  const ref = workspaceRef(token);
  const metaSnap = await ref.get();
  if (metaSnap.exists && (metaSnap.data() as WorkspaceMeta).seeded) return;

  const now = Date.now();
  const batch = getDb().batch();

  SEED_EVENTS.forEach((e, idx) => {
    const id = `${e.date ?? e.dateKind}-${slugify(e.title)}-${idx}`;
    const doc = ref.collection("events").doc(id);
    batch.set(doc, e);
  });
  SEED_ROUTES.forEach((r, idx) => {
    const doc = ref.collection("routes").doc(`${slugify(r.name)}-${idx}`);
    batch.set(doc, r);
  });
  SEED_BUDGET.forEach((b, idx) => {
    const doc = ref.collection("budgetLines").doc(`${b.category.toLowerCase()}-${slugify(b.label)}-${idx}`);
    batch.set(doc, b);
  });
  SEED_CONTINGENCIES.forEach((c, idx) => {
    const doc = ref.collection("contingencies").doc(`${c.category.toLowerCase()}-${slugify(c.situation)}-${idx}`);
    batch.set(doc, c);
  });
  SEED_PACKING.forEach((p, idx) => {
    const doc = ref.collection("packing").doc(`${p.category.toLowerCase()}-${slugify(p.label)}-${idx}`);
    batch.set(doc, p);
  });
  SEED_TODOS.forEach((t, idx) => {
    const doc = ref.collection("preTripTodos").doc(`${slugify(t.label)}-${idx}`);
    batch.set(doc, { ...t, done: false });
  });
  SEED_DAILY_PLANS.forEach((d) => {
    const doc = ref.collection("dailyPlans").doc(d.date);
    batch.set(doc, { ...d, morningChecked: false, eveningChecked: false });
  });

  batch.set(ref, {
    createdAt: now,
    seeded: true,
    lastSeededAt: now,
  } satisfies WorkspaceMeta);

  await batch.commit();
}

export async function listEvents(token: string): Promise<EventItem[]> {
  await ensureTripWorkspace(token);
  const snap = await workspaceRef(token).collection("events").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<EventItem, "id">) }))
    .sort(eventSort);
}

function eventSort(a: EventItem, b: EventItem): number {
  const orderOf = (k: EventItem["dateKind"]) =>
    k === "fixed" ? 0 : k === "anytime" ? 1 : k === "recurring" ? 2 : k === "outside" ? 3 : 4;
  if (orderOf(a.dateKind) !== orderOf(b.dateKind)) {
    return orderOf(a.dateKind) - orderOf(b.dateKind);
  }
  if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date);
  return (a.time ?? "").localeCompare(b.time ?? "");
}

export async function updateEvent(
  token: string,
  eventId: string,
  patch: Partial<EventItem>,
): Promise<void> {
  await workspaceRef(token).collection("events").doc(eventId).update(patch);
  revalidatePath(`/trip/${token}`, "layout");
}

/**
 * One-shot sync that pushes the 2026-05-29 sheet deltas into an existing
 * workspace. Idempotent — re-runs are safe (they re-apply the same patch).
 * Match is by exact title.
 */
export async function syncCalendarFromSheet(token: string): Promise<{
  matched: number;
  patched: string[];
}> {
  type Patch = Partial<EventItem>;
  const PATCHES: Array<{ titleMatch: string; patch: Patch }> = [
    {
      titleMatch: "NYC HealthTech & MedTech Networking",
      patch: {
        registrationStatus: "Registered",
        notes:
          "Picked over Tech Startups (healthtech peers). MedTech Networking Event.pdf saved.",
      },
    },
    {
      titleMatch: "Healthcare AI Professionals & Builders Night",
      patch: {
        dateKind: "fixed",
        date: "2026-06-09",
        day: "Tue",
        time: "6:00–8:00 PM",
        picked: true,
        registrationStatus: "Registered",
        cadence: undefined,
        notes:
          "Approved. Ticket: https://luma.com/e/ticket/evt-Y5ABB54pJ9G5zlk?pk=g-CxeVHnWs1I6x77N. CONFLICT — overlaps MedTech 7:00 PM by 1 hr.",
      },
    },
    {
      titleMatch: "Bio, Eco & Deep Tech Mixer (Antler/Nucleate/Coeus)",
      patch: {
        dateKind: "fixed",
        date: "2026-06-09",
        day: "Tue",
        time: "6:00–8:00 PM",
        registrationStatus: "Pending approval",
        link: "https://luma.com/frontierbuildersmixer?tk=ZiXAxn",
        cadence: undefined,
        notes:
          "Applied — pay attention for approval email. Apply link: https://luma.com/frontierbuildersmixer?tk=ZiXAxn",
      },
    },
    {
      titleMatch: "The Center for Fiction Day Pass",
      patch: {
        cost: "$30",
        registrationStatus: "Registered",
        notes:
          "Anytime drop-in; skeleton slot is Fri. Confirmation in Gmail.",
      },
    },
  ];

  const events = await listEvents(token);
  const ref = workspaceRef(token);
  const batch = getDb().batch();
  const patched: string[] = [];
  let matched = 0;

  PATCHES.forEach(({ titleMatch, patch }) => {
    const target = events.find((e) => e.title === titleMatch);
    if (!target) return;
    matched += 1;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      cleaned[k] = v === undefined ? deleteField() : v;
    }
    batch.update(ref.collection("events").doc(target.id), cleaned);
    patched.push(target.title);
  });

  await batch.commit();
  revalidatePath(`/trip/${token}`, "layout");
  return { matched, patched };
}

function deleteField() {
  // Lazy import so this file stays free of admin-SDK imports until needed.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { FieldValue } = require("firebase-admin/firestore");
  return FieldValue.delete();
}

// ─── Google Sheets two-way sync ──────────────────────────────────────

export async function getSheetConfig(token: string): Promise<{
  sheetId: string | null;
  sheetTabName: string | null;
  lastPushedAt: number | null;
  serviceAccountEmail: string | null;
}> {
  const snap = await workspaceRef(token).get();
  const meta = (snap.exists ? snap.data() : null) as WorkspaceMeta | null;
  return {
    sheetId: meta?.sheetId ?? null,
    sheetTabName: meta?.sheetTabName ?? null,
    lastPushedAt: meta?.lastPushedAt ?? null,
    serviceAccountEmail: getServiceAccountEmail(),
  };
}

export async function setSheetConfig(
  token: string,
  sheetId: string,
  tabName: string,
): Promise<void> {
  const clean = sheetId.trim();
  const cleanTab = tabName.trim();
  if (!clean || !cleanTab) throw new Error("sheetId and tabName required");
  await workspaceRef(token).set(
    { sheetId: clean, sheetTabName: cleanTab },
    { merge: true },
  );
  revalidatePath(`/trip/${token}`, "layout");
}

export async function pushCalendarToSheet(
  token: string,
): Promise<{ rowsWritten: number; tabName: string; sheetId: string }> {
  const cfgSnap = await workspaceRef(token).get();
  const meta = (cfgSnap.exists ? cfgSnap.data() : null) as WorkspaceMeta | null;
  if (!meta?.sheetId || !meta.sheetTabName) {
    throw new Error("Sheet config not set. Add a sheet ID and tab name first.");
  }
  await ensureSheetTab(meta.sheetId, meta.sheetTabName);
  const events = await listEvents(token);

  const header = [
    "Picked",
    "Date",
    "Day",
    "Time",
    "Title",
    "Location",
    "Cost",
    "Tier",
    "Registration type",
    "Status",
    "Link",
    "Notes",
    "Date kind",
    "Cadence",
  ];
  const rows: (string | number | boolean)[][] = events.map((e) => [
    e.picked ? "✓" : "",
    e.date ?? "",
    e.day ?? "",
    e.time ?? "",
    e.title,
    e.location,
    e.cost,
    e.tier,
    e.registration,
    e.registrationStatus ?? "",
    e.link ?? "",
    e.notes ?? "",
    e.dateKind,
    e.cadence ?? "",
  ]);

  await writeSheetValues(meta.sheetId, `${meta.sheetTabName}!A1`, [header, ...rows]);
  await workspaceRef(token).set({ lastPushedAt: Date.now() }, { merge: true });
  revalidatePath(`/trip/${token}`, "layout");
  return { rowsWritten: rows.length, tabName: meta.sheetTabName, sheetId: meta.sheetId };
}

export async function listRoutes(token: string): Promise<RouteBlueprint[]> {
  await ensureTripWorkspace(token);
  const snap = await workspaceRef(token).collection("routes").get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<RouteBlueprint, "id">),
  }));
}

export async function listBudgetLines(token: string): Promise<BudgetLine[]> {
  await ensureTripWorkspace(token);
  const snap = await workspaceRef(token).collection("budgetLines").get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BudgetLine, "id">),
  }));
}

export async function listSpend(token: string): Promise<SpendEntry[]> {
  await ensureTripWorkspace(token);
  const snap = await workspaceRef(token)
    .collection("spend")
    .orderBy("date", "desc")
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SpendEntry, "id">),
  }));
}

export async function logSpend(
  token: string,
  data: Omit<SpendEntry, "id">,
): Promise<string> {
  const ref = workspaceRef(token).collection("spend").doc();
  await ref.set(data);
  revalidatePath(`/trip/${token}`, "layout");
  return ref.id;
}

export async function listContingencies(token: string): Promise<ContingencyCard[]> {
  await ensureTripWorkspace(token);
  const snap = await workspaceRef(token).collection("contingencies").get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<ContingencyCard, "id">),
  }));
}

export async function listPacking(token: string): Promise<PackingItem[]> {
  await ensureTripWorkspace(token);
  const snap = await workspaceRef(token).collection("packing").get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PackingItem, "id">),
  }));
}

export async function togglePacking(
  token: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  await workspaceRef(token).collection("packing").doc(itemId).update({ checked });
  revalidatePath(`/trip/${token}`, "layout");
}

export async function listTodos(token: string): Promise<PreTripTodo[]> {
  await ensureTripWorkspace(token);
  const snap = await workspaceRef(token).collection("preTripTodos").get();
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PreTripTodo, "id">),
  }));
}

export async function toggleTodo(
  token: string,
  todoId: string,
  done: boolean,
): Promise<void> {
  await workspaceRef(token).collection("preTripTodos").doc(todoId).update({ done });
  revalidatePath(`/trip/${token}`, "layout");
}

export async function listDailyPlans(token: string): Promise<DailyPlan[]> {
  await ensureTripWorkspace(token);
  const snap = await workspaceRef(token)
    .collection("dailyPlans")
    .orderBy("date", "asc")
    .get();
  return snap.docs.map((d) => ({
    ...(d.data() as DailyPlan),
  }));
}

export async function getDailyPlan(
  token: string,
  date: string,
): Promise<DailyPlan | null> {
  await ensureTripWorkspace(token);
  const snap = await workspaceRef(token).collection("dailyPlans").doc(date).get();
  if (!snap.exists) return null;
  return snap.data() as DailyPlan;
}

export async function updateDailyPlan(
  token: string,
  date: string,
  patch: Partial<DailyPlan>,
): Promise<void> {
  await workspaceRef(token)
    .collection("dailyPlans")
    .doc(date)
    .set(patch, { merge: true });
  revalidatePath(`/trip/${token}`, "layout");
}
