import { addDays, addMonths, diffDays, snapMinutes, startOfWeek, spansMultipleDays } from './date-utils';
import { isAllDayLike, layoutDayColumn, layoutSpans } from './layout';
import { SchedulerEvent, SchedulerOccurrence } from './models';
import { normalizeEvent, normalizeEvents, toDate } from './normalize';
import { expandOccurrences, parseRRule } from './recurrence';

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);
const occ = (id: string, start: Date, end: Date, allDay = false): SchedulerOccurrence => ({
  key: `${id}::${start.getTime()}`,
  event: normalizeEvent({ id, title: id, start, end, allDay })!,
  start,
  end,
  recurring: false,
});
const expand = (events: SchedulerEvent[], range: { start: Date; end: Date }) => expandOccurrences(normalizeEvents(events), range);

describe('date-utils', () => {
  it('startOfWeek honours weekStartsOn', () => {
    const wed = d(2026, 11, 11);
    expect(startOfWeek(wed, 0)).toEqual(d(2026, 11, 8));
    expect(startOfWeek(wed, 1)).toEqual(d(2026, 11, 9));
  });

  it('addMonths clamps to the last day of shorter months', () => {
    expect(addMonths(d(2026, 1, 31), 1)).toEqual(d(2026, 2, 28));
  });

  it('diffDays counts calendar days across a DST change', () => {
    // Spans the late-March / early-November DST transitions in most zones that observe DST.
    expect(diffDays(d(2026, 3, 1), d(2026, 4, 1))).toBe(31);
    expect(diffDays(d(2026, 10, 25), d(2026, 11, 5))).toBe(11);
    expect(addDays(d(2026, 3, 28, 9), 2).getHours()).toBe(9);
  });

  it('snapMinutes rounds to the step', () => {
    expect(snapMinutes(37, 15)).toBe(30);
    expect(snapMinutes(38, 15)).toBe(45);
  });

  it('spansMultipleDays treats midnight end as exclusive', () => {
    expect(spansMultipleDays(d(2026, 11, 9), d(2026, 11, 10))).toBe(false);
    expect(spansMultipleDays(d(2026, 11, 9, 22), d(2026, 11, 10, 1))).toBe(true);
  });
});

describe('recurrence', () => {
  it('parses supported parts and rejects unknown FREQ', () => {
    expect(parseRRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=4')).toEqual({ freq: 'WEEKLY', interval: 2, count: 4, byDay: [1, 3] });
    expect(parseRRule('FREQ=HOURLY')).toBeNull();
  });

  it('expands weekly BYDAY with COUNT counting from DTSTART', () => {
    const ev: SchedulerEvent = { id: 1, title: 'x', start: d(2026, 11, 2, 9), end: d(2026, 11, 2, 10), rrule: 'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=3' };
    const out = expand([ev], { start: d(2026, 11, 1), end: d(2026, 12, 1) });
    expect(out.map((o) => o.start)).toEqual([d(2026, 11, 2, 9), d(2026, 11, 4, 9), d(2026, 11, 9, 9)]);
    expect(out.every((o) => o.recurring)).toBe(true);
  });

  it('COUNT includes instances before the visible range', () => {
    const ev: SchedulerEvent = { id: 1, title: 'x', start: d(2026, 11, 1, 9), end: d(2026, 11, 1, 10), rrule: 'FREQ=DAILY;COUNT=5' };
    const out = expand([ev], { start: d(2026, 11, 4), end: d(2026, 11, 30) });
    expect(out.map((o) => o.start.getDate())).toEqual([4, 5]);
  });

  it('honours UNTIL, INTERVAL and EXDATE', () => {
    const ev: SchedulerEvent = {
      id: 1,
      title: 'x',
      start: d(2026, 11, 1, 9),
      end: d(2026, 11, 1, 10),
      rrule: 'FREQ=DAILY;INTERVAL=2;UNTIL=20261109T235959',
      exdate: [d(2026, 11, 5, 9)],
    };
    const out = expand([ev], { start: d(2026, 11, 1), end: d(2026, 12, 1) });
    expect(out.map((o) => o.start.getDate())).toEqual([1, 3, 7, 9]);
  });

  it('MONTHLY skips months without that day', () => {
    const ev: SchedulerEvent = { id: 1, title: 'x', start: d(2026, 1, 31, 9), end: d(2026, 1, 31, 10), rrule: 'FREQ=MONTHLY;COUNT=3' };
    const out = expand([ev], { start: d(2026, 1, 1), end: d(2026, 12, 31) });
    expect(out.map((o) => o.start.getMonth() + 1)).toEqual([1, 3, 5]);
  });

  it('keeps non-recurring events that overlap the range and drops invalid ones', () => {
    const ok: SchedulerEvent = { id: 'a', title: 'a', start: d(2026, 10, 31, 22), end: d(2026, 11, 1, 2) };
    const bad: SchedulerEvent = { id: 'b', title: 'b', start: d(2026, 11, 2), end: d(2026, 11, 1) };
    expect(expand([ok, bad], { start: d(2026, 11, 1), end: d(2026, 11, 2) }).map((o) => o.event.id)).toEqual(['a']);
  });
});

describe('layoutDayColumn', () => {
  const day = d(2026, 11, 9);

  it('places a lone event full width at the right offset', () => {
    const [seg] = layoutDayColumn([occ('a', d(2026, 11, 9, 6), d(2026, 11, 9, 12))], day, 0, 24);
    expect(seg.top).toBeCloseTo(25);
    expect(seg.height).toBeCloseTo(25);
    expect(seg.left).toBe(0);
    expect(seg.width).toBe(100);
  });

  it('splits overlapping events into columns and lets a free event expand', () => {
    const segs = layoutDayColumn(
      [
        occ('a', d(2026, 11, 9, 9), d(2026, 11, 9, 11)),
        occ('b', d(2026, 11, 9, 9, 30), d(2026, 11, 9, 10)),
        occ('c', d(2026, 11, 9, 10, 30), d(2026, 11, 9, 11)),
      ],
      day,
      0,
      24,
    );
    const by = Object.fromEntries(segs.map((s) => [s.occ.event.id, s]));
    expect(by['a'].width).toBe(50);
    expect(by['b'].left).toBe(50);
    expect(by['c'].left).toBe(50);
  });

  it('clips to visible hours and flags clipping', () => {
    const [seg] = layoutDayColumn([occ('a', d(2026, 11, 9, 6), d(2026, 11, 9, 10))], day, 8, 18);
    expect(seg.top).toBe(0);
    expect(seg.clippedStart).toBe(true);
    expect(seg.clippedEnd).toBe(false);
  });

  it('skips events entirely outside the visible hours', () => {
    expect(layoutDayColumn([occ('a', d(2026, 11, 9, 2), d(2026, 11, 9, 3))], day, 8, 18)).toEqual([]);
  });
});

describe('layoutSpans', () => {
  it('packs overlapping multi-day events into lanes and marks continuation', () => {
    const band = d(2026, 11, 8);
    const segs = layoutSpans(
      [
        occ('long', d(2026, 11, 6), d(2026, 11, 11), true),
        occ('short', d(2026, 11, 9), d(2026, 11, 10), true),
        occ('later', d(2026, 11, 12), d(2026, 11, 13), true),
      ],
      band,
      7,
    );
    const by = Object.fromEntries(segs.map((s) => [s.occ.event.id, s]));
    expect(by['long']).toMatchObject({ startCol: 0, span: 3, lane: 0, continuesBefore: true, continuesAfter: false });
    expect(by['short']).toMatchObject({ startCol: 1, span: 1, lane: 1 });
    expect(by['later']).toMatchObject({ startCol: 4, lane: 0 });
  });

  it('isAllDayLike for all-day and multi-day occurrences only', () => {
    expect(isAllDayLike(occ('a', d(2026, 11, 9), d(2026, 11, 10), true))).toBe(true);
    expect(isAllDayLike(occ('b', d(2026, 11, 9, 22), d(2026, 11, 10, 2)))).toBe(true);
    expect(isAllDayLike(occ('c', d(2026, 11, 9, 9), d(2026, 11, 9, 10)))).toBe(false);
  });
});

describe('normalize', () => {
  it('parses date-only strings as local midnight and ISO strings as instants', () => {
    expect(toDate('2026-11-09')).toEqual(d(2026, 11, 9));
    expect(toDate('2026-11-09T10:30:00Z')!.toISOString()).toBe('2026-11-09T10:30:00.000Z');
    expect(toDate('nope')).toBeNull();
  });

  it('derives a missing end from duration, all-day (1 day) or the 1-hour default', () => {
    expect(normalizeEvent({ id: 1, title: 'a', start: d(2026, 11, 9, 9), duration: 45 })!.end).toEqual(d(2026, 11, 9, 9, 45));
    expect(normalizeEvent({ id: 2, title: 'b', start: '2026-11-09', allDay: true })!.end).toEqual(d(2026, 11, 10));
    expect(normalizeEvent({ id: 3, title: 'c', start: d(2026, 11, 9, 9) })!.end).toEqual(d(2026, 11, 9, 10));
  });

  it('merges resourceId / resourceIds and turns rrule objects into strings', () => {
    const n = normalizeEvent({ id: 1, title: 'a', start: d(2026, 11, 9), resourceIds: ['x', 'y'], rrule: { freq: 'WEEKLY', byDay: ['MO', 'FR'], count: 4 } })!;
    expect(n.resourceIds).toEqual(['x', 'y']);
    expect(n.rrule).toBe('FREQ=WEEKLY;COUNT=4;BYDAY=MO,FR');
  });

  it('supports rdate, comma-separated exdate strings and YEARLY rules', () => {
    const out = expand(
      [{ id: 1, title: 'x', start: d(2026, 11, 2, 9), end: d(2026, 11, 2, 10), rrule: 'FREQ=DAILY;COUNT=3', exdate: '2026-11-03T09:00:00', rdate: [d(2026, 11, 20, 9)] }],
      { start: d(2026, 11, 1), end: d(2026, 12, 1) },
    );
    expect(out.map((o) => o.start.getDate())).toEqual([2, 4, 20]);
    const yearly = expand([{ id: 2, title: 'y', start: d(2024, 2, 29), allDay: true, rrule: 'FREQ=YEARLY;COUNT=2' }], { start: d(2024, 1, 1), end: d(2032, 1, 1) });
    expect(yearly.map((o) => o.start.getFullYear())).toEqual([2024, 2028]);
  });
});
