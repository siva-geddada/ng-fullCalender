import { addDays, addMinutes, startOfDay } from './date-utils';
import { ExpandedEvent, NormalizedEvent, RRuleOptions, SchedulerEvent, SchedulerOccurrence } from './models';

/**
 * Parses a date input. `YYYY-MM-DD` is read as local midnight (not UTC, unlike `new Date()`),
 * other strings go through the Date parser (ISO 8601 with or without offset).
 */
export function toDate(v: string | Date | undefined | null): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getTime());
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (dateOnly) return new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function toDateList(v: string | Date[] | undefined): Date[] {
  if (!v) return [];
  const items = typeof v === 'string' ? v.split(',') : v;
  return items.map((x) => toDate(typeof x === 'string' ? x.trim() : x)).filter((d): d is Date => !!d);
}

function rruleToString(r: string | RRuleOptions | undefined): string | undefined {
  if (!r) return undefined;
  if (typeof r === 'string') return r;
  const parts = [`FREQ=${r.freq}`];
  if (r.interval) parts.push(`INTERVAL=${r.interval}`);
  if (r.count) parts.push(`COUNT=${r.count}`);
  if (r.until) {
    const u = toDate(r.until);
    if (u) {
      const p = (n: number) => String(n).padStart(2, '0');
      parts.push(`UNTIL=${u.getFullYear()}${p(u.getMonth() + 1)}${p(u.getDate())}T${p(u.getHours())}${p(u.getMinutes())}${p(u.getSeconds())}`);
    }
  }
  if (r.byDay?.length) parts.push(`BYDAY=${r.byDay.join(',')}`);
  return parts.join(';');
}

/** Resolves dates and defaults. Returns null for events without a valid start or with end < start. */
export function normalizeEvent(e: SchedulerEvent): NormalizedEvent | null {
  const start = toDate(e.start);
  if (!start) return null;
  const allDay = !!e.allDay;
  let end = toDate(e.end);
  if (!end) {
    if (e.duration && e.duration > 0) end = addMinutes(start, e.duration);
    else end = allDay ? addDays(startOfDay(start), 1) : addMinutes(start, 60);
  }
  if (end < start) return null;
  const resourceIds = e.resourceIds?.length ? [...e.resourceIds] : e.resourceId !== undefined ? [e.resourceId] : [];
  return {
    source: e,
    id: e.id,
    title: e.title ?? '',
    start: allDay ? startOfDay(start) : start,
    end: allDay && end.getHours() + end.getMinutes() !== 0 ? addDays(startOfDay(end), 1) : end,
    allDay,
    color: e.color,
    textColor: e.textColor,
    borderColor: e.borderColor,
    className: e.className,
    editable: e.editable,
    draggable: e.draggable,
    resizable: e.resizable,
    resourceId: resourceIds[0],
    resourceIds,
    rrule: rruleToString(e.rrule),
    exdate: toDateList(e.exdate),
    rdate: toDateList(e.rdate),
    recurrenceId: toDate(e.recurrenceId as string | Date | undefined) ?? undefined,
    metadata: e.metadata,
  };
}

export function normalizeEvents(events: readonly SchedulerEvent[]): NormalizedEvent[] {
  const out: NormalizedEvent[] = [];
  for (const e of events) {
    const n = normalizeEvent(e);
    if (n) out.push(n);
  }
  return out;
}

/** Public payload form of an occurrence: the source event, or an ExpandedEvent for series instances. */
export function publicEvent(o: SchedulerOccurrence): SchedulerEvent | ExpandedEvent {
  return o.recurring ? toExpandedEvent(o) : o.event.source;
}

export function toExpandedEvent(o: SchedulerOccurrence): ExpandedEvent {
  const e = o.event;
  return {
    id: o.key,
    originalId: e.id,
    title: e.title,
    start: o.start,
    end: o.end,
    allDay: e.allDay,
    isRecurring: o.recurring,
    isException: !!e.recurrenceId,
    originalStart: o.recurring ? o.start : undefined,
    recurringEventId: o.recurring ? e.id : undefined,
    recurrenceId: e.recurrenceId,
    color: e.color,
    textColor: e.textColor,
    className: e.className,
    editable: e.editable,
    draggable: e.draggable,
    resizable: e.resizable,
    resourceId: e.resourceId,
    resourceIds: e.resourceIds,
    categoryId: e.source.categoryId,
    categoryIds: e.source.categoryIds,
    timezone: e.source.timezone,
    metadata: e.metadata,
  };
}
