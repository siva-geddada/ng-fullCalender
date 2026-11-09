import { addDays, addMonths, overlaps, startOfDay } from './date-utils';
import { DateRange, NormalizedEvent, SchedulerOccurrence } from './models';

export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: Date;
  /** 0 = SU … 6 = SA */
  byDay?: number[];
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
/** Hard cap on generated instances per event, guards against runaway rules. */
const MAX_ITERATIONS = 5000;

export function parseRRule(input: string): RecurrenceRule | null {
  const parts = new Map<string, string>();
  for (const seg of input.replace(/^RRULE:/i, '').split(';')) {
    const [k, v] = seg.split('=');
    if (k && v) parts.set(k.trim().toUpperCase(), v.trim().toUpperCase());
  }
  const freq = parts.get('FREQ');
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') return null;

  const rule: RecurrenceRule = { freq, interval: Math.max(1, Number(parts.get('INTERVAL') ?? 1) || 1) };
  const count = parts.get('COUNT');
  if (count && Number(count) > 0) rule.count = Number(count);
  const until = parts.get('UNTIL');
  if (until) rule.until = parseIcsDate(until) ?? undefined;
  const byDay = parts.get('BYDAY');
  if (byDay) {
    const days = byDay.split(',').map((c) => DAY_CODES.indexOf(c.slice(-2))).filter((i) => i >= 0);
    if (days.length) rule.byDay = [...new Set(days)].sort((a, b) => a - b);
  }
  return rule;
}

/** Accepts 20261231, 20261231T090000 (local) and 20261231T090000Z (UTC). Date-only UNTIL covers the whole day. */
export function parseIcsDate(v: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h = '23', mi = '59', s = '59', z] = m;
  const args = [+y, +mo - 1, +d, +h, +mi, +s] as const;
  return z ? new Date(Date.UTC(...args)) : new Date(...args);
}

/**
 * Candidate start dates in chronological order, starting with DTSTART itself.
 * COUNT counts every generated instance (RFC 5545), including ones before the range.
 */
function* candidateStarts(start: Date, rule: RecurrenceRule): Generator<Date> {
  const timeH = start.getHours(), timeM = start.getMinutes(), timeS = start.getSeconds();
  const withTime = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), timeH, timeM, timeS);

  if (rule.freq === 'DAILY') {
    for (let i = 0; ; i++) yield addDays(start, i * rule.interval);
  }

  if (rule.freq === 'WEEKLY') {
    const byDay = rule.byDay ?? [start.getDay()];
    // Weeks anchored on the Sunday of DTSTART's week (WKST=SU).
    const weekAnchor = addDays(startOfDay(start), -start.getDay());
    for (let w = 0; ; w += rule.interval) {
      for (const dow of byDay) {
        const c = withTime(addDays(weekAnchor, w * 7 + dow));
        if (c >= start) yield c;
      }
    }
  }

  // MONTHLY / YEARLY: same day-of-month; periods without that date are skipped (RFC behavior).
  const months = rule.freq === 'YEARLY' ? 12 * rule.interval : rule.interval;
  for (let i = 0; ; i++) {
    const m = addMonths(new Date(start.getFullYear(), start.getMonth(), 1), i * months);
    if (new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate() < start.getDate()) continue;
    yield new Date(m.getFullYear(), m.getMonth(), start.getDate(), timeH, timeM, timeS);
  }
}

function occurrence(event: NormalizedEvent, start: Date, end: Date, recurring: boolean): SchedulerOccurrence {
  return { key: `${event.id}::${start.getTime()}`, event, start, end, recurring };
}

function inRange(s: Date, e: Date, range: DateRange): boolean {
  return overlaps(s, e, range.start, range.end) || (s.getTime() === e.getTime() && s >= range.start && s < range.end);
}

/** Expands normalized events into occurrences that overlap `range`, sorted by start (longest first on ties). */
export function expandOccurrences(events: readonly NormalizedEvent[], range: DateRange): SchedulerOccurrence[] {
  const out: SchedulerOccurrence[] = [];
  for (const ev of events) {
    const duration = ev.end.getTime() - ev.start.getTime();
    const rule = ev.rrule ? parseRRule(ev.rrule) : null;

    if (!rule && !ev.rdate.length) {
      if (inRange(ev.start, ev.end, range)) out.push(occurrence(ev, ev.start, ev.end, false));
      continue;
    }

    const excluded = new Set(ev.exdate.map((d) => d.getTime()));
    const seen = new Set<number>();
    const push = (s: Date) => {
      const t = s.getTime();
      if (excluded.has(t) || seen.has(t)) return;
      seen.add(t);
      const e = new Date(t + duration);
      if (inRange(s, e, range)) out.push(occurrence(ev, s, e, true));
    };

    if (rule) {
      let generated = 0;
      let iterations = 0;
      for (const s of candidateStarts(ev.start, rule)) {
        if (++iterations > MAX_ITERATIONS) break;
        if (rule.until && s > rule.until) break;
        if (s >= range.end) break;
        generated++;
        if (rule.count !== undefined && generated > rule.count) break;
        push(s);
      }
    } else {
      push(ev.start);
    }
    for (const r of ev.rdate) push(r);
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
}
