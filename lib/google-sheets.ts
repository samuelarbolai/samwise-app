import 'server-only';
import { JWT } from 'google-auth-library';

// Minimal Google Sheets API helpers. JWT bearer auth via the existing
// FIREBASE_SERVICE_ACCOUNT credential, raw fetch against Sheets v4.
// Mirrors lib/google-calendar.ts. The service-account email needs Editor
// access on the target spreadsheet.

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

let cachedClient: JWT | null = null;
function getJwtClient(): JWT {
  if (cachedClient) return cachedClient;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT not set');
  const creds = JSON.parse(raw) as { client_email: string; private_key: string };
  cachedClient = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: SCOPES,
  });
  return cachedClient;
}

async function getAccessToken(): Promise<string> {
  const client = getJwtClient();
  const res = await client.getAccessToken();
  if (!res.token) throw new Error('No access token returned by JWT client');
  return res.token;
}

async function sheetsFetch<T = unknown>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

/** Return the service-account email from FIREBASE_SERVICE_ACCOUNT (for UI display). */
export function getServiceAccountEmail(): string | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const creds = JSON.parse(raw) as { client_email?: string };
    return creds.client_email ?? null;
  } catch {
    return null;
  }
}

/** Returns the set of tab names that exist in the spreadsheet. */
export async function listTabNames(spreadsheetId: string): Promise<string[]> {
  interface MetaResponse {
    sheets?: Array<{ properties?: { title?: string } }>;
  }
  const data = await sheetsFetch<MetaResponse>(
    `${SHEETS_BASE}/${spreadsheetId}?fields=sheets.properties.title`,
  );
  return (data.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter(Boolean);
}

/** Create the tab if it doesn't already exist. Idempotent. */
export async function ensureSheetTab(
  spreadsheetId: string,
  tabName: string,
): Promise<void> {
  const existing = await listTabNames(spreadsheetId);
  if (existing.includes(tabName)) return;
  await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: tabName } } }],
    }),
  });
}

/**
 * Overwrite the given range with a 2D matrix of values. Clears first so old
 * rows don't linger. `range` is in A1 notation including tab name, e.g.
 * `"trip-app!A1"`.
 */
export async function writeSheetValues(
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][],
): Promise<void> {
  const encodedRange = encodeURIComponent(range);
  // 1. Clear existing values across the full tab range derived from `range`.
  // We clear the explicit tab area by passing just the tab portion.
  const tabName = range.split('!')[0];
  const clearRange = encodeURIComponent(tabName);
  await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}/values/${clearRange}:clear`, {
    method: 'POST',
  });
  // 2. Write fresh values starting at the anchor cell.
  await sheetsFetch(
    `${SHEETS_BASE}/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values }),
    },
  );
}
