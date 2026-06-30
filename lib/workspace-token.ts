const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateWorkspaceToken(): string {
  const random = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(random);
  } else {
    for (let i = 0; i < random.length; i++) {
      random[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(random)
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join("");
}

export function isValidWorkspaceToken(token: string | undefined | null): boolean {
  if (!token) return false;
  return /^[a-z2-9]{6,40}$/.test(token);
}

// Per-app localStorage reader/minter. Each app passes its own key
// (samwise.trip.workspaceToken / samwise.outreach.workspaceToken /
// samwise.ritual.workspaceToken) so the apps' identities stay distinct.
// Falls back to an ephemeral token if localStorage is unavailable
// (private mode, blocked storage).
export function readOrMintWorkspaceToken(storageKey: string): string {
  try {
    if (typeof window === "undefined") return generateWorkspaceToken();
    const existing = window.localStorage.getItem(storageKey);
    if (isValidWorkspaceToken(existing)) return existing as string;
    const fresh = generateWorkspaceToken();
    window.localStorage.setItem(storageKey, fresh);
    return fresh;
  } catch {
    return generateWorkspaceToken();
  }
}

// Storage keys per surface. Centralized so a typo doesn't leak users
// from one app's workspace into another's.
export const RITUAL_WORKSPACE_KEY = "samwise.ritual.workspaceToken";
