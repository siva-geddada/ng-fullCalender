import { WeekDay } from './models';

export const MINUTE = 60_000;
export const DAY_MINUTES = 24 * 60;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Calendar-day arithmetic (DST-safe: keeps wall-clock time). */
export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + months, 1, d.getHours(), d.getMinutes());
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), lastDay));
  return r;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * MINUTE);
}

export function startOfWeek(d: Date, weekStartsOn: WeekDay): Date {
  const day = startOfDay(d);
  const diff = (day.getDay() - weekStartsOn + 7) % 7;
  return addDays(day, -diff);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Whole calendar days between the starts of two days (DST-safe). */
export function diffDays(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** Wall-clock minutes since local midnight. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/** Local date at `day` + wall-clock `minutes` (may exceed 1440 to roll over). */
export function atMinutes(day: Date, minutes: number): Date {
  const base = startOfDay(day);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, Math.round(minutes));
}

export function eachDay(start: Date, endExclusive: Date): Date[] {
  const days: Date[] = [];
  for (let d = startOfDay(start); d < endExclusive; d = addDays(d, 1)) days.push(d);
  return days;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function snapMinutes(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** True if the occurrence covers more than one calendar day (end exclusive). */
export function spansMultipleDays(start: Date, end: Date): boolean {
  const lastInstant = new Date(Math.max(start.getTime(), end.getTime() - 1));
  return !isSameDay(start, lastInstant);
}

/** `'HH:mm'` / `'HH:mm:ss'` → minutes from midnight (`'24:00'` → 1440). */
export function parseTime(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim());
  if (!m) return fallback;
  return clamp(+m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0), 0, DAY_MINUTES);
}

/** ISO-8601 week number (weeks start Monday, week 1 contains Jan 4th). */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/** US week number (weeks start Sunday, week 1 contains Jan 1st). */
export function usWeek(d: Date): number {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.floor((diffDays(jan1, d) + jan1.getDay()) / 7) + 1;
}

export function weekNumber(d: Date, numbering: 'auto' | 'iso' | 'us', firstDayOfWeek: WeekDay): number {
  const mode = numbering === 'auto' ? (firstDayOfWeek === 1 ? 'iso' : 'us') : numbering;
  return mode === 'iso' ? isoWeek(d) : usWeek(d);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function addYears(d: Date, years: number): Date {
  return addMonths(d, years * 12);
}

/** Local `YYYY-MM-DD`. */
export function toDateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local ISO without offset for all-day values, full ISO instant for timed ones. */
export function toPayloadStr(d: Date, allDay: boolean): string {
  return allDay ? toDateStr(d) : d.toISOString();
}

/**
 * Applies a 12h/24h preference to a locale using the Unicode hour-cycle extension,
 * so it stays per scheduler instance: `withHourCycle('de', '12h')` → `'de-u-hc-h12'`.
 */
export function withHourCycle(locale: string | undefined, timeFormat: '12h' | '24h' | 'auto'): string | undefined {
  if (timeFormat === 'auto') return locale;
  const base = (locale ?? new Intl.DateTimeFormat().resolvedOptions().locale).replace(/-u-.*$/, '');
  return `${base}-u-hc-${timeFormat === '24h' ? 'h23' : 'h12'}`;
}

// ---------- formatting (Intl, cached) ----------

const fmtCache = new Map<string, Intl.DateTimeFormat>();

export function format(d: Date, locale: string | undefined, opts: Intl.DateTimeFormatOptions): string {
  const key = `${locale ?? ''}|${JSON.stringify(opts)}`;
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, opts);
    fmtCache.set(key, f);
  }
  return f.format(d);
}

export function formatTime(d: Date, locale: string | undefined): string {
  return format(d, locale, { hour: 'numeric', minute: '2-digit' });
}

export function formatHour(h: number, locale: string | undefined): string {
  return format(new Date(2000, 0, 1, h), locale, { hour: 'numeric' });
}

export function formatTimeRange(a: Date, b: Date, locale: string | undefined): string {
  return `${formatTime(a, locale)} – ${formatTime(b, locale)}`;
}

export function weekdayNames(locale: string | undefined, weekStartsOn: WeekDay, style: 'short' | 'long' | 'narrow' = 'short'): string[] {
  // 2023-01-01 was a Sunday.
  return Array.from({ length: 7 }, (_, i) => format(new Date(2023, 0, 1 + ((weekStartsOn + i) % 7)), locale, { weekday: style }));
}
