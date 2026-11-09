import { addDays, clamp, diffDays, isSameDay, minutesOfDay, spansMultipleDays, startOfDay } from './date-utils';
import { SchedulerOccurrence } from './models';

/** Positioned timed occurrence inside one day column. Values are percentages. */
export interface TimedSegment {
  occ: SchedulerOccurrence;
  top: number;
  height: number;
  left: number;
  width: number;
  /** Occurrence started before this column's visible window. */
  clippedStart: boolean;
  /** Occurrence ends after this column's visible window. */
  clippedEnd: boolean;
}

/** Occurrence spanning whole day cells, placed on a lane (row) within a band of days. */
export interface SpanSegment {
  occ: SchedulerOccurrence;
  /** Index of the first covered day within the band. */
  startCol: number;
  /** Number of covered days within the band (>= 1). */
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Goes into an all-day band (rather than the timed grid) in day/week views. */
export function isAllDayLike(o: SchedulerOccurrence): boolean {
  return !!o.event.allDay || spansMultipleDays(o.start, o.end);
}

/** Last calendar day an occurrence touches (end is exclusive; all-day events end at midnight). */
export function lastDay(o: SchedulerOccurrence): Date {
  return startOfDay(new Date(Math.max(o.start.getTime(), o.end.getTime() - 1)));
}

/**
 * Lays out timed occurrences for one day column between startHour and endHour.
 * Overlapping events are grouped into clusters and spread across equal columns,
 * each event expanding right into free neighbor columns.
 */
export function layoutDayColumn(
  occs: readonly SchedulerOccurrence[],
  day: Date,
  startHour: number,
  endHour: number,
): TimedSegment[] {
  const winStart = startHour * 60;
  const winEnd = endHour * 60;
  const span = winEnd - winStart;
  const dayStart = startOfDay(day);
  const nextDay = addDays(dayStart, 1);

  type Item = { occ: SchedulerOccurrence; s: number; e: number; clippedStart: boolean; clippedEnd: boolean; col: number };
  const items: Item[] = [];
  for (const occ of occs) {
    if (occ.start >= nextDay || occ.end <= dayStart) continue;
    const rawS = occ.start < dayStart ? 0 : minutesOfDay(occ.start);
    const rawE = occ.end >= nextDay ? 24 * 60 : minutesOfDay(occ.end);
    const s = clamp(rawS, winStart, winEnd);
    // Zero-length or tiny events still get a visible minimum of 15 minutes.
    let e = clamp(Math.max(rawE, rawS + 15), winStart, winEnd);
    if (e <= s) {
      if (rawE <= winStart || rawS >= winEnd) continue; // entirely outside the visible hours
      e = Math.min(winEnd, s + 15);
    }
    items.push({ occ, s, e, clippedStart: rawS < winStart, clippedEnd: rawE > winEnd, col: 0 });
  }
  items.sort((a, b) => a.s - b.s || b.e - a.e);

  const out: TimedSegment[] = [];
  let cluster: Item[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    for (const it of cluster) {
      let c = colEnds.findIndex((end) => end <= it.s);
      if (c === -1) c = colEnds.length;
      colEnds[c] = it.e;
      it.col = c;
    }
    const cols = colEnds.length;
    for (const it of cluster) {
      // Expand right while no other item in the cluster occupies the neighbor column at this time.
      let reach = 1;
      while (
        it.col + reach < cols &&
        !cluster.some((o) => o.col === it.col + reach && o.s < it.e && o.e > it.s)
      ) reach++;
      out.push({
        occ: it.occ,
        top: ((it.s - winStart) / span) * 100,
        height: ((it.e - it.s) / span) * 100,
        left: (it.col / cols) * 100,
        width: (reach / cols) * 100,
        clippedStart: it.clippedStart,
        clippedEnd: it.clippedEnd,
      });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of items) {
    if (it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();
  return out;
}

/**
 * Packs whole-day occurrences into lanes over a band of consecutive days
 * (an all-day row in week view, or one week row in month view).
 */
export function layoutSpans(occs: readonly SchedulerOccurrence[], bandStart: Date, days: number): SpanSegment[] {
  const start = startOfDay(bandStart);
  const sorted = [...occs].sort((a, b) => {
    const da = diffDays(a.start, lastDay(a));
    const db = diffDays(b.start, lastDay(b));
    return a.start.getTime() - b.start.getTime() || db - da;
  });

  const laneEnds: number[] = []; // last occupied column per lane
  const out: SpanSegment[] = [];
  for (const occ of sorted) {
    const firstIdx = diffDays(start, occ.start);
    const lastIdx = diffDays(start, lastDay(occ));
    if (lastIdx < 0 || firstIdx >= days) continue;
    const startCol = Math.max(0, firstIdx);
    const endCol = Math.min(days - 1, lastIdx);
    let lane = laneEnds.findIndex((end) => end < startCol);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endCol;
    out.push({
      occ,
      startCol,
      span: endCol - startCol + 1,
      lane,
      continuesBefore: firstIdx < 0,
      continuesAfter: lastIdx >= days,
    });
  }
  return out;
}

/** Occurrences touching a given calendar day. */
export function occurrencesOnDay(occs: readonly SchedulerOccurrence[], day: Date): SchedulerOccurrence[] {
  const d = startOfDay(day);
  return occs.filter((o) => startOfDay(o.start) <= d && lastDay(o) >= d);
}

export function isToday(d: Date, now = new Date()): boolean {
  return isSameDay(d, now);
}
