// Slot computation. Pure function — no I/O. Given a window and the
// busy intervals on the calendar in that window, returns the array of
// (day, free-slot-starts) for the next N days.
//
// Timezone: America/Bogota, permanent UTC-5 (Colombia doesn't observe
// DST), so we hardcode the offset instead of pulling in a tz lib.

export const TIMEZONE = 'America/Bogota';
const BOGOTA_OFFSET = '-05:00';

const WORK_DAYS = [1, 2, 3, 4, 5]; // Mon–Fri (Sun=0)
const WORK_START_HOUR = 6;
const WORK_START_MIN = 0;
const WORK_END_HOUR = 18;
const WORK_END_MIN = 30;
export const SLOT_DURATION_MIN = 50;
const GRANULARITY_MIN = 30;
const MIN_NOTICE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS_OUT = 14;

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface DaySlots {
  /** YYYY-MM-DD in Bogotá-local */
  day: string;
  /** HH:mm Bogotá-local — start times only */
  slots: string[];
}

// Build a Date from a Bogotá-local clock time. Uses ISO with explicit
// offset for reliability (avoids any tz inference).
function bogotaToUTC(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const iso =
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` +
    `T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000${BOGOTA_OFFSET}`;
  return new Date(iso);
}

// Format a UTC Date as Bogotá-local YYYY-MM-DD parts.
function partsInBogota(d: Date): { year: number; month: number; day: number; dow: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(d);
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    year: Number(parts.find((p) => p.type === 'year')!.value),
    month: Number(parts.find((p) => p.type === 'month')!.value),
    day: Number(parts.find((p) => p.type === 'day')!.value),
    dow: weekdayMap[parts.find((p) => p.type === 'weekday')!.value],
  };
}

function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function computeAvailability(args: {
  now: Date;
  busy: BusyInterval[];
  daysOut?: number;
  /** Slot length in minutes (defaults to the Breakthrough Call's 50). */
  durationMin?: number;
  /** Start-time step in minutes (defaults to 30). */
  granularityMin?: number;
}): DaySlots[] {
  const daysOut = args.daysOut ?? DEFAULT_DAYS_OUT;
  const durationMin = args.durationMin ?? SLOT_DURATION_MIN;
  const granularityMin = args.granularityMin ?? GRANULARITY_MIN;
  const minBookableTime = new Date(args.now.getTime() + MIN_NOTICE_MS);

  const result: DaySlots[] = [];

  // Iterate from "today (Bogotá)" through daysOut. Use noon-UTC anchors
  // and add 24h increments — robust across month/year boundaries.
  const today = partsInBogota(args.now);
  const anchorMs = Date.UTC(today.year, today.month - 1, today.day, 17, 0); // noon Bogotá (17:00 UTC)

  for (let i = 0; i <= daysOut; i++) {
    const candidate = new Date(anchorMs + i * 24 * 60 * 60 * 1000);
    const { year, month, day, dow } = partsInBogota(candidate);

    if (!WORK_DAYS.includes(dow)) continue;

    const workStartMin = WORK_START_HOUR * 60 + WORK_START_MIN;
    const workEndMin = WORK_END_HOUR * 60 + WORK_END_MIN;
    const lastStartMin = workEndMin - durationMin;

    const slots: string[] = [];
    for (let m = workStartMin; m <= lastStartMin; m += granularityMin) {
      const h = Math.floor(m / 60);
      const mn = m % 60;
      const slotStart = bogotaToUTC(year, month, day, h, mn);
      const slotEnd = new Date(slotStart.getTime() + durationMin * 60 * 1000);

      // Past or within minimum-notice window
      if (slotStart < minBookableTime) continue;

      // Overlaps a busy interval on Samuel's calendar
      const conflict = args.busy.some((b) =>
        intervalsOverlap(slotStart, slotEnd, b.start, b.end),
      );
      if (conflict) continue;

      slots.push(`${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`);
    }

    if (slots.length > 0) {
      result.push({
        day: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        slots,
      });
    }
  }

  return result;
}

// Helper for the create-route: turn a (day, HH:mm) pair into the
// concrete ISO start + end strings the Calendar API needs.
export function slotToISORange(args: {
  day: string; // YYYY-MM-DD
  slot: string; // HH:mm
  durationMin?: number; // defaults to the Breakthrough Call's 50
}): { startISO: string; endISO: string } {
  const [yStr, monStr, dStr] = args.day.split('-');
  const [hStr, mnStr] = args.slot.split(':');
  const year = Number(yStr);
  const month = Number(monStr);
  const day = Number(dStr);
  const hour = Number(hStr);
  const minute = Number(mnStr);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid day/slot: ${args.day} ${args.slot}`);
  }
  const durationMin = args.durationMin ?? SLOT_DURATION_MIN;
  const start = bogotaToUTC(year, month, day, hour, minute);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);

  // Calendar API accepts ISO with offset; preserve the Bogotá-local
  // offset so the event displays correctly in Samuel's calendar.
  function toIsoWithOffset(d: Date): string {
    // d is UTC-anchored. Build the YYYY-MM-DDTHH:mm:ss-05:00 form
    // by reading Bogotá-local parts.
    const localParts = partsInBogota(d);
    const localTimeFmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const tparts = localTimeFmt.formatToParts(d);
    const h = tparts.find((p) => p.type === 'hour')!.value;
    const mn = tparts.find((p) => p.type === 'minute')!.value;
    const s = tparts.find((p) => p.type === 'second')!.value;
    return (
      `${localParts.year}-${String(localParts.month).padStart(2, '0')}-` +
      `${String(localParts.day).padStart(2, '0')}T${h}:${mn}:${s}${BOGOTA_OFFSET}`
    );
  }

  return {
    startISO: toIsoWithOffset(start),
    endISO: toIsoWithOffset(end),
  };
}
