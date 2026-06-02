import 'server-only';
import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { getDb } from '@/lib/firebase-admin';

// `walkIns/{walkInId}` doc shape. Created by /api/walk-in/init when a
// prospect submits the /meet lobby form. Read by /meet/[walkInId] on
// samwise-app when Samuel clicks the notification email link.
//
// `walkInId` shape: `{prospectKey}-{ts}` — same convention as
// qualifications. Per-call unique so concurrent walk-ins don't collide.
export interface WalkInDoc {
  roomName: string;
  prospectKey: string;
  prospect: { name: string; email: string };
  language: 'en' | 'es';
  status: 'waiting' | 'joined' | 'completed';
  /** True when the room runs with the autonomous AI guide instead of a human
   * therapist. Read at join to dispatch the demo-call agent (idempotently). */
  autonomous?: boolean;
  createdAt?: Timestamp;
  joinedAt?: Timestamp;
}

// Normalize the prospect's email into the same key shape used by
// extractQualification / loadQualification, so copilot's pre-fill works
// against the same prospectKey if the prospect did /qualify previously.
export function emailToProspectKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
}

export async function createWalkIn(args: {
  walkInId: string;
  roomName: string;
  prospectKey: string;
  prospect: { name: string; email: string };
  language: 'en' | 'es';
  autonomous?: boolean;
}): Promise<void> {
  await getDb()
    .collection('walkIns')
    .doc(args.walkInId)
    .set({
      roomName: args.roomName,
      prospectKey: args.prospectKey,
      prospect: args.prospect,
      language: args.language,
      status: 'waiting' as const,
      autonomous: args.autonomous ?? false,
      createdAt: FieldValue.serverTimestamp(),
    });
}

export async function readWalkIn(
  walkInId: string,
): Promise<WalkInDoc | null> {
  const snap = await getDb().collection('walkIns').doc(walkInId).get();
  if (!snap.exists) return null;
  return snap.data() as WalkInDoc;
}

// Best-effort notification email to Samuel. Writes to `mail/{auto-id}`;
// Firebase Trigger Email extension watches that collection and sends via
// the configured SMTP (per memory `reference_firebase_trigger_email_setup.md`).
export async function notifySamuelOfWalkIn(args: {
  walkInId: string;
  prospect: { name: string; email: string };
  language: 'en' | 'es';
}): Promise<void> {
  const { walkInId, prospect, language } = args;
  // Hardcoded prod URL for v1; lift to env var if a preview/staging
  // domain ever needs a different value.
  const joinUrl = `https://app.samwise.life/meet/${walkInId}`;
  const langLabel = language === 'es' ? 'Español' : 'English';

  const subject = `${prospect.name} joined your meeting`;
  const text = `${prospect.name} (${prospect.email}) is in the room.

Language: ${langLabel}

Join: ${joinUrl}
`;

  // Inline-styled, table-based HTML for email-client compat (same shape
  // convention as buildPostCallEmailDoc / buildDemoCallLinkEmailDoc in
  // cloud-functions/functions/src/index.ts).
  const html = `<!doctype html>
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
          ${escapeHtml(prospect.name)} is in the room.
        </td></tr>
        <tr><td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 500; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #555555; padding: 0 0 6px 0;">
          Email
        </td></tr>
        <tr><td style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #000000; padding: 0 0 20px 0;">
          ${escapeHtml(prospect.email)}
        </td></tr>
        <tr><td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 500; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #555555; padding: 0 0 6px 0;">
          Language
        </td></tr>
        <tr><td style="font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #000000; padding: 0 0 40px 0;">
          ${escapeHtml(langLabel)}
        </td></tr>
        <tr><td style="padding: 0 0 12px 0;">
          <a href="${escapeHtml(joinUrl)}" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 600; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #000000; text-decoration: none; border-bottom: 1px solid #D4A85A; padding-bottom: 2px;">
            Join the call
          </a>
        </td></tr>
        <tr><td style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 400; font-size: 13px; line-height: 1.5; color: #555555; padding: 0 0 0 0; word-break: break-all;">
          <a href="${escapeHtml(joinUrl)}" style="color: #555555; text-decoration: underline;">${escapeHtml(joinUrl)}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await getDb().collection('mail').add({
    to: 'samuelgiraldoconcha@gmail.com',
    message: { subject, text, html },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
