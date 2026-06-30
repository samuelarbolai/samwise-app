import 'server-only';
import { Timestamp } from 'firebase-admin/firestore';
import type { JSONContent } from '@tiptap/react';
import { getDb } from '@/lib/firebase-admin';
import {
  TAB_KEYS,
  TAB_TEMPLATES,
  emptyTabs,
  type RitualDoc,
  type Tab,
  type TabKey,
} from './schema';

const COLLECTION = 'ritualDocs';

export async function createRitualDoc(language: 'en' | 'es' = 'en'): Promise<{ id: string }> {
  const now = Timestamp.now();
  const ref = await getDb().collection(COLLECTION).add({
    createdAt: now,
    updatedAt: now,
    language,
    tabs: Object.fromEntries(
      TAB_KEYS.map((k) => [k, { tiptap: TAB_TEMPLATES[k], updatedAt: now }]),
    ),
  });
  return { id: ref.id };
}

export async function getRitualDoc(id: string): Promise<RitualDoc | null> {
  const snap = await getDb().collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const tabs = (data.tabs ?? {}) as Record<
    string,
    { tiptap?: JSONContent; updatedAt?: Timestamp }
  >;
  const now = new Date();
  // Tolerate partial docs (a future tab added after this doc was
  // created): fill missing keys with the seeded template so the
  // client never crashes on undefined.
  const filled = emptyTabs(now);
  for (const k of TAB_KEYS) {
    const t = tabs[k];
    if (t?.tiptap) {
      filled[k] = {
        tiptap: t.tiptap,
        updatedAt: t.updatedAt?.toDate() ?? now,
      };
    }
  }
  return {
    id: snap.id,
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? now,
    updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate() ?? now,
    language: data.language === 'es' ? 'es' : 'en',
    tabs: filled,
  };
}

export async function saveTab(
  id: string,
  tab: TabKey,
  tiptap: JSONContent,
): Promise<void> {
  const now = Timestamp.now();
  // Dotted-path update patches one tab without rewriting the whole
  // `tabs` map (which would race with concurrent saves to other tabs).
  await getDb()
    .collection(COLLECTION)
    .doc(id)
    .update({
      [`tabs.${tab}.tiptap`]: tiptap,
      [`tabs.${tab}.updatedAt`]: now,
      updatedAt: now,
    });
}

// Creates (or returns idempotently) a ritualDoc tied to a workspace
// token. Idempotency rule per user direction 2026-06-29: if the token
// has an UNSEALED doc, return its id (resume in-flight onboarding); if
// it has only SEALED docs, mint a fresh unsealed one (Start Now =
// always-new for returning users). Requires a Firestore composite
// index on (workspaceToken ASC, sealedAt ASC) — Firebase prints a
// one-click create link in logs the first time the query runs missing.
export async function createRitualDocForWorkspace(
  workspaceToken: string,
  language: 'en' | 'es' = 'en',
): Promise<{ id: string; created: boolean }> {
  const db = getDb();

  const existing = await db
    .collection(COLLECTION)
    .where('workspaceToken', '==', workspaceToken)
    .where('sealedAt', '==', null)
    .limit(1)
    .get();
  if (!existing.empty) {
    return { id: existing.docs[0].id, created: false };
  }

  const now = Timestamp.now();
  const ref = await db.collection(COLLECTION).add({
    createdAt: now,
    updatedAt: now,
    language,
    workspaceToken,
    sealedAt: null,
    tabs: Object.fromEntries(
      TAB_KEYS.map((k) => [k, { tiptap: TAB_TEMPLATES[k], updatedAt: now }]),
    ),
  });
  return { id: ref.id, created: true };
}

// Called by the registerRitualFromTiptap CF after a successful seal.
// Marks the ritualDoc so the onboarding bootstrap won't return it on
// future /start visits (mints a fresh doc instead).
export async function markSealed(id: string, sealedRitualId: string): Promise<void> {
  const now = Timestamp.now();
  await getDb().collection(COLLECTION).doc(id).update({
    sealedAt: now,
    sealedRitualId,
    updatedAt: now,
  });
}

export type { Tab };
