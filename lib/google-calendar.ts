import 'server-only';
import { JWT } from 'google-auth-library';

// Minimal Google Calendar API helpers — JWT bearer-token auth via the
// existing FIREBASE_SERVICE_ACCOUNT credential, raw fetch against the
// Calendar v3 REST API. No `googleapis` package (~100MB unpacked); the
// two endpoints we use (freeBusy + events.insert) don't justify the
// dep weight.
//
// Service account setup (per current-plan.md Step 12.0):
//   1. Calendar API enabled in arbor-2026 GCP project
//   2. Samuel's calendar shared with `client_email` from the service
//      account, permission "Make changes to events"
//   3. BOOKING_CALENDAR_ID env var = the shared calendar's id

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const CAL_BASE = 'https://www.googleapis.com/calendar/v3';

interface BusyInterval {
  start: string; // ISO 8601
  end: string;
}

export interface FreeBusyResponse {
  busy: Array<{ start: Date; end: Date }>;
}

export interface CreateEventArgs {
  calendarId: string;
  summary: string;
  description?: string;
  startISO: string; // full ISO with offset, e.g. 2026-05-30T10:00:00-05:00
  endISO: string;
  timeZone: string; // e.g. "America/Bogota"
  attendee: { email: string; displayName: string };
}

export interface CreateEventResult {
  eventId: string;
  htmlLink: string;
  hangoutLink?: string;
}

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

async function calFetch<T>(
  path: string,
  init: RequestInit & { searchParams?: Record<string, string> } = {},
): Promise<T> {
  const token = await getAccessToken();
  const url = new URL(`${CAL_BASE}${path}`);
  for (const [k, v] of Object.entries(init.searchParams ?? {})) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Calendar API ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// Query busy intervals on the given calendar in [timeMin, timeMax].
// Returns ALL busy ranges (recurring + one-off) Google sees on the
// target calendar.
export async function freeBusy(args: {
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
  timeZone: string;
}): Promise<FreeBusyResponse> {
  interface FBResponse {
    calendars: Record<string, { busy: BusyInterval[] }>;
  }
  const body = {
    timeMin: args.timeMin.toISOString(),
    timeMax: args.timeMax.toISOString(),
    timeZone: args.timeZone,
    items: [{ id: args.calendarId }],
  };
  const data = await calFetch<FBResponse>('/freeBusy', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const cal = data.calendars[args.calendarId];
  if (!cal) throw new Error(`No calendar entry returned for ${args.calendarId}`);
  return {
    busy: cal.busy.map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    })),
  };
}

// Patch only the description of an existing event. Used by
// /api/book/create to inject the join URLs after the calEventId is
// known (the URLs are derived from it).
export async function patchEventDescription(args: {
  calendarId: string;
  eventId: string;
  description: string;
}): Promise<void> {
  await calFetch(
    `/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.eventId)}`,
    {
      method: 'PATCH',
      searchParams: { sendUpdates: 'none' },
      body: JSON.stringify({ description: args.description }),
    },
  );
}

// Create an event on the calendar. NOTE: we do NOT pass the `attendees`
// field to Google because personal Gmail accounts (non-Workspace)
// reject service-account event creation with attendees:
//   "Service accounts cannot invite attendees without Domain-Wide
//    Delegation of Authority"
// Workaround: the attendee info travels in the event `description`
// instead (built by the caller), and the prospect gets our own
// Samwise-branded confirmation email via the mail/ collection. No
// Google calendar invite is sent — but Samuel sees the event on his
// samwise calendar, which is what matters.
//
// If we ever move to Workspace + DWD, restore the attendees field
// and `sendUpdates=all` to let Google handle invite emails too.
export async function insertEvent(args: CreateEventArgs): Promise<CreateEventResult> {
  interface EventResponse {
    id: string;
    htmlLink: string;
    hangoutLink?: string;
  }
  const body = {
    summary: args.summary,
    description: args.description,
    start: { dateTime: args.startISO, timeZone: args.timeZone },
    end: { dateTime: args.endISO, timeZone: args.timeZone },
  };
  const data = await calFetch<EventResponse>(
    `/calendars/${encodeURIComponent(args.calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
    hangoutLink: data.hangoutLink,
  };
}
