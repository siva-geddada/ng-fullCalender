import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import {
  MINUTE,
  addDays,
  atMinutes,
  clamp,
  eachDay,
  format,
  formatTime,
  formatTimeRange,
  isSameDay,
  minutesOfDay,
  snapMinutes,
  startOfDay,
} from '../core/date-utils';
import { isToday } from '../core/layout';
import { SchedulerOccurrence, SchedulerResource } from '../core/models';
import { SchEventContent } from '../components/event-content';
import { SchEventPopoverTrigger } from '../components/popover';
import { trackPointer } from '../interaction/pointer';
import { SchedulerStore } from '../state/scheduler-store';

export type TimelineScale = 'day' | 'week' | 'month' | 'year';

interface Slot {
  start: Date;
  end: Date;
  /** Shaded: outside business hours (day/week), weekend (month) or outside min/max dates. */
  muted: boolean;
}

interface HeaderCell {
  label: string;
  sub?: string;
  col: number;
  span: number;
  today: boolean;
}

interface Item {
  occ: SchedulerOccurrence;
  left: number;
  width: number;
  lane: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

interface Row {
  key: string;
  resource: SchedulerResource | null;
  items: Item[];
  height: number;
}

const UNASSIGNED = '\u0000unassigned';
const LANE = 34;
const ROW_PAD = 8;
const MIN_EVENT_PX = 10;

/** Horizontal timeline at day, week, month or year scale, one row per resource. */
@Component({
  selector: 'sch-timeline-view',
  imports: [SchEventContent, SchEventPopoverTrigger],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sch-tl',
    '[class.sch-tl--no-resources]': '!hasResources()',
    '[attr.data-sch-scale]': 'scale()',
    '[style.--sch-tl-slot]': 'slotWidth() + "px"',
    '[style.--sch-tl-resource]': 'resourceWidth() + "px"',
  },
  template: `
    <div class="sch-tl__scroll">
      <div class="sch-tl__inner" role="grid" [attr.aria-label]="store.title()" [style.width.px]="resourceWidth() + totalWidth()">
        <div class="sch-tl__head" role="rowgroup">
          <div class="sch-tl__corner">{{ hasResources() ? resourceHeader() : '' }}</div>
          <div class="sch-tl__tiers" [style.width.px]="totalWidth()">
            @for (tier of tiers(); track $index; let last = $last) {
              <div
                class="sch-tl__tier"
                role="row"
                [class.sch-tl__tier--leaf]="last"
                [style.grid-template-columns]="'repeat(' + slots().length + ', var(--sch-tl-slot))'"
              >
                @for (c of tier; track $index) {
                  <div class="sch-tl__hcell" role="columnheader" [class.sch-is-today]="c.today" [style.grid-column]="c.col + 1 + ' / span ' + c.span">
                    <span class="sch-tl__hlabel">{{ c.label }}</span>
                    @if (c.sub) {
                      <span class="sch-tl__hsub">{{ c.sub }}</span>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>

        @for (row of rows(); track row.key) {
          <div class="sch-tl__row" role="row" [style.height.px]="row.height">
            <div class="sch-tl__resource" role="rowheader" [style.--sch-event-color]="row.resource?.color ?? null">
              @if (hasResources()) {
                <span class="sch-tl__swatch" aria-hidden="true"></span>
                <span class="sch-tl__rname">{{ row.resource?.title ?? store.label('unassigned') }}</span>
              }
            </div>
            <div class="sch-tl__track" [attr.data-sch-resource]="row.key" [style.width.px]="totalWidth()" (pointerdown)="onTrackDown($event, row)">
              @for (m of mutedBands(); track $index) {
                <div class="sch-tl__muted" aria-hidden="true" [style.left.px]="m.left" [style.width.px]="m.width"></div>
              }
              @if (selectionIn(row.key); as sel) {
                <div class="sch-tl__selection" [class.sch-is-invalid]="!sel.valid" [style.left.px]="sel.left" [style.width.px]="sel.width"></div>
              }
              @for (it of row.items; track it.occ.key) {
                <div
                  class="sch-event sch-event--tl"
                  role="button"
                  tabindex="0"
                  [class]="it.occ.event.className ?? ''"
                  [class.sch-event--cont-before]="it.clippedStart"
                  [class.sch-event--cont-after]="it.clippedEnd"
                  [class.sch-is-dragging]="store.drag()?.key === it.occ.key"
                  [class.sch-is-invalid]="isInvalid(it.occ)"
                  [style.--sch-event-color]="store.colorOf(it.occ)"
                  [style.--sch-event-text]="it.occ.event.textColor ?? null"
                  [style.--sch-event-border]="it.occ.event.borderColor ?? null"
                  [style.left.px]="it.left"
                  [style.width.px]="it.width"
                  [style.top.px]="it.lane * lane + 4"
                  [attr.aria-label]="aria(it.occ)"
                  [schEventPopover]="it.occ"
                  (pointerdown)="onEventDown($event, it.occ, 'move', row)"
                  (dblclick)="store.eventDblclick(it.occ, $event, $any($event.currentTarget))"
                  (keydown.enter)="click(it.occ, $event)"
                  (keydown.space)="click(it.occ, $event)"
                >
                  <sch-event-content [occ]="it.occ" [compact]="true" [showTime]="minuteScale()" />
                  @if (store.canResize(it.occ) && !it.clippedEnd) {
                    <div class="sch-event__resize sch-event__resize--x" aria-hidden="true" (pointerdown)="onEventDown($event, it.occ, 'resize', row)"></div>
                  }
                </div>
              }
              @if (nowLeft() !== null) {
                <div class="sch-tl__now" [style.left.px]="nowLeft()" aria-hidden="true"></div>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class SchTimelineView {
  protected readonly store = inject(SchedulerStore);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly opts = this.store.options;
  protected readonly lane = LANE;

  protected readonly scale = computed<TimelineScale>(() => (this.store.activeView()?.data?.['scale'] as TimelineScale) ?? 'day');
  protected readonly minuteScale = computed(() => this.scale() === 'day' || this.scale() === 'week');
  protected readonly hasResources = computed(() => this.store.resources().length > 0);
  protected readonly resourceWidth = computed(() => (this.hasResources() ? this.opts().resourceAreaWidth : 0));
  protected readonly resourceHeader = computed(() => this.opts().resourceAreaHeaderContent || this.store.label('resources'));
  protected readonly slotWidth = computed(() => this.opts().timelineSlotWidth);

  // ---------- slots ----------
  private readonly days = computed(() => {
    const all = eachDay(this.store.range().start, this.store.range().end);
    const filter = this.opts().daysOfWeek;
    if (!filter || this.scale() !== 'week') return all;
    const kept = all.filter((d) => filter.includes(d.getDay()));
    return kept.length ? kept : all;
  });

  private isBusiness(start: Date, end: Date): boolean {
    const o = this.opts();
    if (!o.showBusinessHours || !o.businessHours.length) return true;
    const mid = minutesOfDay(new Date((start.getTime() + end.getTime()) / 2));
    return o.businessHours.some((b) => {
      const [sh, sm] = b.startTime.split(':').map(Number);
      const [eh, em] = b.endTime.split(':').map(Number);
      return b.daysOfWeek.includes(start.getDay()) && mid >= sh * 60 + (sm || 0) && mid < eh * 60 + (em || 0);
    });
  }

  protected readonly slots = computed<Slot[]>(() => {
    const o = this.opts();
    const scale = this.scale();
    const out: Slot[] = [];
    if (scale === 'day' || scale === 'week') {
      for (const d of this.days()) {
        for (let m = o.timelineMinTime; m < o.timelineMaxTime; m += o.timelineSlotDuration) {
          const start = atMinutes(d, m);
          const end = atMinutes(d, Math.min(m + o.timelineSlotDuration, o.timelineMaxTime));
          out.push({ start, end, muted: !this.isBusiness(start, end) || this.store.isDateDisabled(d) });
        }
      }
    } else if (scale === 'month') {
      for (const d of this.days()) {
        out.push({ start: d, end: addDays(d, 1), muted: d.getDay() === 0 || d.getDay() === 6 || this.store.isDateDisabled(d) });
      }
    } else {
      const y = this.store.range().start.getFullYear();
      for (let m = 0; m < 12; m++) out.push({ start: new Date(y, m, 1), end: new Date(y, m + 1, 1), muted: false });
    }
    return out;
  });

  protected readonly totalWidth = computed(() => this.slots().length * this.slotWidth());

  /** X position (px) of a date along the slot axis; hidden hours collapse to the next slot. */
  private px(d: Date): number {
    const slots = this.slots();
    const t = d.getTime();
    if (!slots.length || t <= slots[0].start.getTime()) return 0;
    let lo = 0;
    let hi = slots.length - 1;
    if (t >= slots[hi].end.getTime()) return slots.length * this.slotWidth();
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (slots[mid].start.getTime() <= t) lo = mid;
      else hi = mid - 1;
    }
    const s = slots[lo];
    const frac = clamp((t - s.start.getTime()) / (s.end.getTime() - s.start.getTime()), 0, 1);
    return (lo + frac) * this.slotWidth();
  }

  /** Inverse of px(): the date at an x offset inside the track. */
  private dateAtPx(x: number): Date {
    const slots = this.slots();
    const unit = clamp(x / this.slotWidth(), 0, slots.length - 1e-6);
    const i = Math.floor(unit);
    const s = slots[i];
    return new Date(s.start.getTime() + (unit - i) * (s.end.getTime() - s.start.getTime()));
  }

  /** Snap to minutes (day/week scales, timed events) or to whole days. */
  private snap(d: Date, allDay: boolean): Date {
    if (!this.minuteScale() || allDay) return startOfDay(new Date(d.getTime() + 12 * 3_600_000));
    return atMinutes(startOfDay(d), snapMinutes(minutesOfDay(d), this.opts().timelineSnapDuration));
  }

  private snapUnitMs(allDay: boolean): number {
    return !this.minuteScale() || allDay ? 86_400_000 : this.opts().timelineSnapDuration * MINUTE;
  }

  // ---------- header tiers ----------
  protected readonly tiers = computed<HeaderCell[][]>(() => {
    const slots = this.slots();
    const loc = this.opts().locale;
    const scale = this.scale();
    const group = (key: (s: Slot) => string, label: (s: Slot) => string, today?: (s: Slot) => boolean) => {
      const cells: HeaderCell[] = [];
      slots.forEach((s, i) => {
        const last = cells[cells.length - 1];
        if (last && key(slots[i - 1]) === key(s)) last.span++;
        else cells.push({ label: label(s), col: i, span: 1, today: !!today?.(s) });
      });
      return cells;
    };
    if (scale === 'day' || scale === 'week') {
      const top = group(
        (s) => String(startOfDay(s.start).getTime()),
        (s) => format(s.start, loc, { weekday: 'long', month: 'short', day: 'numeric' }),
        (s) => isToday(s.start),
      );
      const leaf = slots.map((s, i) => ({ label: formatTime(s.start, loc), col: i, span: 1, today: false }));
      return [top, leaf];
    }
    if (scale === 'month') {
      const top = group((s) => `${s.start.getFullYear()}-${s.start.getMonth()}`, (s) => format(s.start, loc, { month: 'long', year: 'numeric' }));
      const leaf = slots.map((s, i) => ({
        label: String(s.start.getDate()),
        sub: format(s.start, loc, { weekday: 'short' }),
        col: i,
        span: 1,
        today: isToday(s.start),
      }));
      return [top, leaf];
    }
    const now = new Date();
    const top = group((s) => String(s.start.getFullYear()), (s) => String(s.start.getFullYear()));
    const leaf = slots.map((s, i) => ({
      label: format(s.start, loc, { month: 'short' }),
      col: i,
      span: 1,
      today: s.start.getFullYear() === now.getFullYear() && s.start.getMonth() === now.getMonth(),
    }));
    return [top, leaf];
  });

  /** Merged shaded intervals. */
  protected readonly mutedBands = computed(() => {
    const out: { left: number; width: number }[] = [];
    const w = this.slotWidth();
    this.slots().forEach((s, i) => {
      if (!s.muted) return;
      const last = out[out.length - 1];
      if (last && Math.abs(last.left + last.width - i * w) < 0.5) last.width += w;
      else out.push({ left: i * w, width: w });
    });
    return out;
  });

  // ---------- rows ----------
  protected readonly rows = computed<Row[]>(() => {
    const { start: rs, end: re } = this.store.range();
    const occs = this.store.displayOccurrences().filter((o) => o.start < re && o.end > rs);
    const resources = this.store.resources();
    const minH = this.opts().resourceRowHeight;
    const known = new Set(resources.map((r) => r.id));
    const buckets = new Map<string, { resource: SchedulerResource | null; occs: SchedulerOccurrence[] }>();
    for (const r of resources) buckets.set(String(r.id), { resource: r, occs: [] });
    const unassigned: SchedulerOccurrence[] = [];
    for (const o of occs) {
      const ids = o.event.resourceIds.filter((id) => known.has(id));
      if (!resources.length || !ids.length) unassigned.push(o);
      else for (const id of ids) buckets.get(String(id))!.occs.push(o);
    }
    const list = [...buckets.entries()].map(([key, b]) => ({ key, ...b }));
    if (unassigned.length || !resources.length) list.push({ key: UNASSIGNED, resource: null, occs: unassigned });

    const total = this.totalWidth();
    return list.map(({ key, resource, occs: rowOccs }) => {
      const laneEnds: number[] = [];
      const items: Item[] = [];
      for (const o of rowOccs) {
        const left = this.px(o.start);
        const right = Math.max(this.px(o.end), left + MIN_EVENT_PX);
        if (left >= total || right <= 0) continue;
        let lane = laneEnds.findIndex((end) => end <= left + 0.5);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = right;
        items.push({ occ: o, left, width: Math.max(MIN_EVENT_PX, right - left - 2), lane, clippedStart: o.start < rs, clippedEnd: o.end > re });
      }
      return { key, resource, items, height: Math.max(minH, laneEnds.length * LANE + ROW_PAD) };
    });
  });

  private readonly liveSel = signal<{ row: string; from: Date; to: Date; valid: boolean } | null>(null);
  private readonly now = signal(new Date());
  protected readonly nowLeft = computed(() => {
    if (!this.opts().nowIndicator) return null;
    const n = this.now();
    if (!this.slots().some((s) => n >= s.start && n < s.end)) return null;
    return this.px(n);
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      clearInterval(timer);
      timer = setInterval(() => this.now.set(new Date()), this.opts().nowIndicatorInterval);
    });
    destroyRef.onDestroy(() => clearInterval(timer));

    // Initial horizontal scroll: "now" if visible, else the scroll time (day/week scales).
    afterNextRender(() => {
      const sc = this.el.nativeElement.querySelector<HTMLElement>('.sch-tl__scroll');
      if (!sc) return;
      const now = this.nowLeft();
      let x = now ?? 0;
      if (now === null && this.minuteScale()) x = this.px(atMinutes(this.days()[0], this.opts().scrollTime));
      sc.scrollLeft = Math.max(0, x - sc.clientWidth / 3);
    });
  }

  // ---------- display ----------
  protected aria(o: SchedulerOccurrence): string {
    const loc = this.opts().locale;
    if (o.event.allDay || !isSameDay(o.start, new Date(o.end.getTime() - 1))) {
      const f: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${o.event.title}, ${format(o.start, loc, f)} – ${format(addDays(o.end, -1), loc, f)}`;
    }
    return `${o.event.title}, ${formatTimeRange(o.start, o.end, loc)}`;
  }

  protected isInvalid(o: SchedulerOccurrence): boolean {
    const d = this.store.drag();
    return !!d && d.key === o.key && !d.valid;
  }

  protected selectionIn(rowKey: string): { left: number; width: number; valid: boolean } | null {
    const live = this.liveSel();
    if (live) {
      if (live.row !== rowKey) return null;
      const left = this.px(live.from);
      return { left, width: Math.max(4, this.px(live.to) - left), valid: live.valid };
    }
    const s = this.store.selection();
    if (!s) return null;
    const key = s.resourceId === undefined ? (this.hasResources() ? null : UNASSIGNED) : String(s.resourceId);
    if (key !== rowKey) return null;
    const left = this.px(s.start);
    const width = this.px(s.end) - left;
    return width > 0 ? { left, width, valid: true } : null;
  }

  protected click(o: SchedulerOccurrence, e: Event): void {
    e.preventDefault();
    this.store.activateEvent(o, e, e.currentTarget as HTMLElement);
  }

  // ---------- geometry ----------
  private at(x: number, y: number): { rowKey: string; date: Date } | null {
    const tracks = Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>('[data-sch-resource]'));
    if (!tracks.length) return null;
    let t = tracks.find((el) => {
      const r = el.getBoundingClientRect();
      return y >= r.top && y < r.bottom;
    });
    if (!t) t = y < tracks[0].getBoundingClientRect().top ? tracks[0] : tracks[tracks.length - 1];
    const r = t.getBoundingClientRect();
    return { rowKey: t.dataset['schResource']!, date: this.dateAtPx(x - r.left) };
  }

  private resourceIdFor(key: string): string | number | undefined {
    return this.store.resources().find((r) => String(r.id) === key)?.id;
  }

  // ---------- interactions ----------
  protected onEventDown(e: PointerEvent, displayed: SchedulerOccurrence, kind: 'move' | 'resize', row: Row): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    const occ = this.store.original(displayed);
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>('.sch-event');
    const allowed = kind === 'move' ? this.store.canDrag(occ) : this.store.canResize(occ);
    const a0 = this.at(e.clientX, e.clientY);
    if (!a0) return;
    const duration = occ.end.getTime() - occ.start.getTime();
    const allDay = occ.event.allDay;
    const unit = this.snapUnitMs(allDay);
    const fromResource = row.resource?.id;
    let started = false;

    trackPointer(
      e,
      {
        move: (ev) => {
          const a = this.at(ev.clientX, ev.clientY);
          if (!allowed || !a) return;
          if (!started) {
            started = true;
            this.store.dragStart(occ, kind, el, ev);
          }
          const delta = a.date.getTime() - a0.date.getTime();
          if (kind === 'move') {
            const start = this.snap(new Date(occ.start.getTime() + delta), allDay);
            const targetRes = a.rowKey !== a0.rowKey ? this.resourceIdFor(a.rowKey) : undefined;
            this.store.dragMove(occ, 'move', start, new Date(start.getTime() + duration), ev, targetRes, targetRes !== undefined ? fromResource : undefined);
          } else {
            let end = this.snap(new Date(occ.end.getTime() + delta), allDay);
            if (end.getTime() < occ.start.getTime() + unit) end = new Date(occ.start.getTime() + unit);
            this.store.dragMove(occ, 'resize', occ.start, end, ev);
          }
        },
        end: (ev, dragged) => {
          if (!dragged || !started) {
            this.store.drag.set(null);
            this.store.activateEvent(occ, ev, el);
            return;
          }
          this.store.dragEnd(occ, kind, ev);
        },
        cancel: () => started && this.store.dragCancel(occ, kind),
      },
      this.opts().dragMinDistance,
    );
  }

  protected onTrackDown(e: PointerEvent, row: Row): void {
    if (e.button !== 0 || this.opts().disabled) return;
    const a0 = this.at(e.clientX, e.clientY);
    if (!a0) return;
    const allDay = !this.minuteScale();
    const resourceId = row.resource?.id;
    const step = this.opts().timelineSnapDuration;
    const floorTo = (d: Date) => (allDay ? startOfDay(d) : atMinutes(startOfDay(d), Math.floor(minutesOfDay(d) / step) * step));
    const stepEnd = (d: Date) => (allDay ? addDays(d, 1) : new Date(d.getTime() + step * MINUTE));
    const d0 = floorTo(a0.date);
    if (this.store.isDateDisabled(d0)) return;
    const make = (d: Date) => {
      const p = floorTo(d);
      const from = p < d0 ? p : d0;
      const to = stepEnd(p < d0 ? d0 : p);
      return { row: row.key, from, to, valid: this.store.isSelectionAllowed(from, to, allDay, resourceId) };
    };
    const canSelect = this.store.canSelect();
    if (canSelect) this.liveSel.set(make(a0.date));
    trackPointer(
      e,
      {
        move: (ev) => {
          const a = this.at(ev.clientX, ev.clientY);
          if (canSelect && a) this.liveSel.set(make(a.date));
        },
        end: (ev, dragged) => {
          const s = this.liveSel();
          this.liveSel.set(null);
          if (!dragged) this.store.dateClick(d0, allDay, ev, resourceId);
          if (s?.valid) this.store.selectRange(s.from, s.to, allDay, ev, resourceId);
        },
        cancel: () => this.liveSel.set(null),
      },
      this.opts().dragMinDistance,
    );
  }
}
