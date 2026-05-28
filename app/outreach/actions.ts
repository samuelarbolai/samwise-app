"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/firebase-admin";
import { SEED_CONTACTS, SEED_TEMPLATES } from "./_seed";
import type {
  Contact,
  DailySession,
  Mistake,
  Template,
  WorkspaceMeta,
} from "./_types";

function workspaceRef(token: string) {
  if (!/^[a-z2-9]{6,40}$/.test(token)) {
    throw new Error(`Invalid workspace token: ${token}`);
  }
  return getDb().collection("outreachWorkspaces").doc(token);
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

const inFlightSeed = new Map<string, Promise<void>>();

export async function ensureWorkspace(token: string): Promise<void> {
  if (inFlightSeed.has(token)) return inFlightSeed.get(token);
  const p = doEnsureWorkspace(token).finally(() => inFlightSeed.delete(token));
  inFlightSeed.set(token, p);
  return p;
}

async function doEnsureWorkspace(token: string): Promise<void> {
  const ref = workspaceRef(token);
  const metaSnap = await ref.get();
  if (metaSnap.exists && (metaSnap.data() as WorkspaceMeta).seeded) return;

  const now = Date.now();
  const batch = getDb().batch();

  SEED_CONTACTS.forEach((c, idx) => {
    const id = `${slugify(c.name)}-${String(idx).padStart(3, "0")}`;
    const doc = ref.collection("contacts").doc(id);
    batch.set(doc, { ...c, createdAt: now + idx, updatedAt: now + idx });
  });

  SEED_TEMPLATES.forEach((t, idx) => {
    const id = `${t.audience.toLowerCase()}-${slugify(t.name)}`;
    const doc = ref.collection("templates").doc(id);
    batch.set(doc, {
      ...t,
      version: 1,
      locked: false,
      retired: false,
      createdAt: now + idx,
    });
  });

  const meta: WorkspaceMeta = {
    createdAt: now,
    seeded: true,
    lastSeededAt: now,
  };
  batch.set(ref, meta);

  await batch.commit();
}

export async function listContacts(token: string): Promise<Contact[]> {
  await ensureWorkspace(token);
  const snap = await workspaceRef(token)
    .collection("contacts")
    .orderBy("updatedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Contact, "id">) }));
}

export async function createContact(
  token: string,
  data: Partial<Contact>,
): Promise<string> {
  const now = Date.now();
  const ref = workspaceRef(token).collection("contacts").doc();
  await ref.set({
    name: "",
    step: "Queued",
    recommendationStatus: "Not asked",
    ...data,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath(`/outreach/${token}`, "layout");
  return ref.id;
}

export async function updateContact(
  token: string,
  contactId: string,
  patch: Partial<Contact>,
): Promise<void> {
  const ref = workspaceRef(token).collection("contacts").doc(contactId);
  await ref.update({ ...patch, updatedAt: Date.now() });
  revalidatePath(`/outreach/${token}`, "layout");
}

export async function deleteContact(token: string, contactId: string): Promise<void> {
  await workspaceRef(token).collection("contacts").doc(contactId).delete();
  revalidatePath(`/outreach/${token}`, "layout");
}

export async function listTemplates(token: string): Promise<Template[]> {
  await ensureWorkspace(token);
  const snap = await workspaceRef(token)
    .collection("templates")
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Template, "id">) }));
}

export async function createTemplateVersion(
  token: string,
  parentId: string,
  newBody: string,
): Promise<string> {
  const db = getDb();
  const parentRef = workspaceRef(token).collection("templates").doc(parentId);
  const parentSnap = await parentRef.get();
  if (!parentSnap.exists) throw new Error("Parent template not found");
  const parent = parentSnap.data() as Template;
  const ref = workspaceRef(token).collection("templates").doc();
  const now = Date.now();
  await db.batch()
    .set(ref, {
      name: parent.name,
      audience: parent.audience,
      version: parent.version + 1,
      body: newBody,
      parentVersionId: parentId,
      locked: false,
      retired: false,
      createdAt: now,
    })
    .update(parentRef, { retired: true })
    .commit();
  revalidatePath(`/outreach/${token}`, "layout");
  return ref.id;
}

export async function lockTemplate(token: string, templateId: string): Promise<void> {
  await workspaceRef(token)
    .collection("templates")
    .doc(templateId)
    .update({ locked: true, lockedAt: Date.now() });
  revalidatePath(`/outreach/${token}`, "layout");
}

export async function createTemplate(
  token: string,
  data: { name: string; audience: Template["audience"]; body: string },
): Promise<string> {
  const ref = workspaceRef(token).collection("templates").doc();
  await ref.set({
    ...data,
    version: 1,
    locked: false,
    retired: false,
    createdAt: Date.now(),
  });
  revalidatePath(`/outreach/${token}`, "layout");
  return ref.id;
}

export async function listMistakes(token: string): Promise<Mistake[]> {
  await ensureWorkspace(token);
  const snap = await workspaceRef(token)
    .collection("mistakes")
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Mistake, "id">) }));
}

export async function createMistake(
  token: string,
  data: Omit<Mistake, "id" | "createdAt">,
): Promise<string> {
  const ref = workspaceRef(token).collection("mistakes").doc();
  await ref.set({ ...data, createdAt: Date.now() });
  revalidatePath(`/outreach/${token}`, "layout");
  return ref.id;
}

export async function getDailySession(
  token: string,
  date: string,
): Promise<DailySession> {
  const ref = workspaceRef(token).collection("sessions").doc(date);
  const snap = await ref.get();
  if (snap.exists) return { date, ...(snap.data() as Omit<DailySession, "date">) };
  return {
    date,
    sentCount: 0,
    repliesCount: 0,
    meetingsCount: 0,
    targetLinkedin: 25,
    targetPhone: 5,
    targetFollowups: 3,
  };
}

export async function updateDailySession(
  token: string,
  date: string,
  patch: Partial<DailySession>,
): Promise<void> {
  const ref = workspaceRef(token).collection("sessions").doc(date);
  await ref.set({ ...patch }, { merge: true });
  revalidatePath(`/outreach/${token}`, "layout");
}
