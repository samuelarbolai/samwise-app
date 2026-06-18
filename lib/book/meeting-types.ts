// Meeting types for the booking flow. The picker UI, the calendar plumbing,
// and the confirmation email are all shared; only these knobs differ per type:
// slot duration/granularity, which calendar to book against, the event title,
// and the confirmation-email copy.
//
// `breakthrough` is the prospect's Breakthrough Call (the original /book).
// `therapist` is the behavioural-change expert's 15-minute adoption test
// (booked from /therapists/book) — a distinct meeting (user 2026-06-16).
//
// Different calendar: set THERAPIST_BOOKING_CALENDAR_ID on the server to point
// the therapist test at a separate Google Calendar. If unset, it falls back to
// BOOKING_CALENDAR_ID (so nothing breaks before the calendar exists).

export type MeetingType = "breakthrough" | "therapist" | "therapist-demo";
export type BookLang = "en" | "es";

export interface MeetingTypeConfig {
  type: MeetingType;
  durationMin: number;
  granularityMin: number;
  /** Optional env var naming a dedicated calendar; falls back to BOOKING_CALENDAR_ID. */
  calendarIdEnv?: string;
  /** Calendar event title + .ics summary. */
  summary: string;
  email: {
    subject: Record<BookLang, string>;
    intro: (when: string, lang: BookLang) => string;
  };
}

export const MEETING_TYPES: Record<MeetingType, MeetingTypeConfig> = {
  breakthrough: {
    type: "breakthrough",
    durationMin: 50,
    granularityMin: 30,
    summary: "Samwise Breakthrough Call",
    email: {
      subject: { en: "Your call is booked", es: "Tu llamada está reservada" },
      intro: (when, lang) =>
        lang === "es"
          ? `Reservamos tu llamada para ${when} (hora de Bogotá). Cuando llegue el momento, entra con este link:`
          : `We've got you down for ${when} (Bogotá time). When the time comes, join here:`,
    },
  },
  therapist: {
    type: "therapist",
    durationMin: 15,
    granularityMin: 15,
    calendarIdEnv: "THERAPIST_BOOKING_CALENDAR_ID",
    summary: "Samwise — therapist adoption test",
    email: {
      subject: {
        en: "Your Samwise test is booked",
        es: "Tu prueba de Samwise está reservada",
      },
      intro: (when, lang) =>
        lang === "es"
          ? `Tu prueba de 15 minutos para adoptar Samwise está reservada para ${when} (hora de Bogotá). Entra aquí cuando llegue el momento:`
          : `Your 15-minute test of adopting Samwise is set for ${when} (Bogotá time). Join here when it's time:`,
    },
  },
  // The 50-minute therapist DEMO — booked at the end of the therapist
  // qualification call (the /qualify therapist audience's final screen). This
  // is where the /therapists visuals get presented, Samuel-led. Distinct from
  // the 15-minute `therapist` adoption test reached from the landing close.
  "therapist-demo": {
    type: "therapist-demo",
    durationMin: 50,
    granularityMin: 30,
    calendarIdEnv: "THERAPIST_DEMO_CALENDAR_ID",
    summary: "Samwise — therapist demo",
    email: {
      subject: {
        en: "Your Samwise demo is booked",
        es: "Tu demo de Samwise está reservada",
      },
      intro: (when, lang) =>
        lang === "es"
          ? `Tu demo de 50 minutos de Samwise está reservada para ${when} (hora de Bogotá). Entra aquí cuando llegue el momento:`
          : `Your 50-minute Samwise demo is set for ${when} (Bogotá time). Join here when it's time:`,
    },
  },
};

// Validate an untrusted `type` value (query/body); anything unknown → default.
export function resolveMeetingType(v: string | null | undefined): MeetingTypeConfig {
  if (v === "therapist") return MEETING_TYPES.therapist;
  if (v === "therapist-demo") return MEETING_TYPES["therapist-demo"];
  return MEETING_TYPES.breakthrough;
}

// Resolve the calendar id for a meeting type: a dedicated calendar if its env
// var is set, otherwise the shared BOOKING_CALENDAR_ID.
export function calendarIdFor(config: MeetingTypeConfig): string | undefined {
  if (config.calendarIdEnv) {
    const dedicated = process.env[config.calendarIdEnv];
    if (dedicated && dedicated.trim()) return dedicated;
  }
  return process.env.BOOKING_CALENDAR_ID;
}
