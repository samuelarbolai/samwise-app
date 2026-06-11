import 'server-only';
import { getDb } from '@/lib/firebase-admin';
import { TIMEZONE } from '@/lib/book/availability';

// Best-effort admin notifications to Samuel. Each writes a doc to the
// `mail/{auto-id}` collection; the Firebase Trigger Email extension
// watches that collection and sends via the configured SMTP (per memory
// `reference_firebase_trigger_email_setup.md`). Same editorial email
// shell as notifySamuelOfWalkIn in lib/walk-in/walkin.ts.

const SAMUEL = 'samuelgiraldoconcha@gmail.com';

function langLabel(language: 'en' | 'es'): string {
  return language === 'es' ? 'Español' : 'English';
}

function formatBogotaHuman(startISO: string, language: 'en' | 'es'): string {
  const d = new Date(startISO);
  return new Intl.DateTimeFormat(language === 'es' ? 'es-CO' : 'en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: language === 'en',
  }).format(d);
}

// Notify: a prospect just STARTED a /qualify voice session. The point is
// to let Samuel nudge them toward booking, so name + email lead.
export async function notifySamuelOfQualifyStart(args: {
  name: string;
  email: string;
  language: 'en' | 'es';
}): Promise<void> {
  const { name, email, language } = args;
  const subject = `${name} started a qualifying session`;
  const text = `${name} (${email}) just started a qualifying session on /qualify.

Language: ${langLabel(language)}

Reach out and push them toward booking the call.
`;
  const html = adminEmailShell({
    subject,
    lead: `${name} just started a qualifying session.`,
    rows: [
      { label: 'Email', value: email },
      { label: 'Language', value: langLabel(language) },
    ],
  });
  await getDb().collection('mail').add({
    to: SAMUEL,
    replyTo: email,
    message: { subject, text, html },
  });
}

// Notify: a prospect just BOOKED a call via /book.
export async function notifySamuelOfBooking(args: {
  name: string;
  email: string;
  language: 'en' | 'es';
  startISO: string;
}): Promise<void> {
  const { name, email, language, startISO } = args;
  const when = formatBogotaHuman(startISO, language);
  const subject = `${name} booked a call`;
  const text = `${name} (${email}) booked a call.

When: ${when} (Bogotá time)
Language: ${langLabel(language)}
`;
  const html = adminEmailShell({
    subject,
    lead: `${name} booked a call.`,
    rows: [
      { label: 'When', value: `${when} (Bogotá)` },
      { label: 'Email', value: email },
      { label: 'Language', value: langLabel(language) },
    ],
  });
  await getDb().collection('mail').add({
    to: SAMUEL,
    replyTo: email,
    message: { subject, text, html },
  });
}

// ── Shared editorial email shell ─────────────────────────────────────
// Inline-styled table layout, same register as notifySamuelOfWalkIn /
// buildBookingConfirmationEmail (Georgia-fallback serif + Helvetica-
// fallback sans, gold ✦ wordmark).
function adminEmailShell(params: {
  subject: string;
  lead: string;
  rows: Array<{ label: string; value: string }>;
}): string {
  const { subject, lead, rows } = params;
  const rowsHtml = rows
    .map(
      (r) => `
        <tr><td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 500; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #555555; padding: 0 0 6px 0;">
          ${escapeHtml(r.label)}
        </td></tr>
        <tr><td style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #000000; padding: 0 0 20px 0;">
          ${escapeHtml(r.value)}
        </td></tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background: #FFFFFF; color: #000000;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #FFFFFF;">
    <tr><td align="center" style="padding: 56px 24px 48px 24px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width: 560px; width: 100%;">
        <tr><td style="padding: 0 0 40px 0;">
          <span style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; font-size: 22px; letter-spacing: -0.01em; color: #000000;">Samwise</span><span style="color: #D4A85A; font-size: 9px; vertical-align: 12px; padding-left: 3px;">&#x2726;</span>
        </td></tr>
        <tr><td style="font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400; font-size: 20px; line-height: 1.45; color: #000000; padding: 0 0 28px 0;">
          ${escapeHtml(lead)}
        </td></tr>
        ${rowsHtml}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
