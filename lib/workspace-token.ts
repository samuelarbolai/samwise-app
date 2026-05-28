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
