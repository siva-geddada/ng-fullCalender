import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  MINUTE,
  addDays,
  atMinutes,
  clamp,
  eachDay,
  format,
  formatHour,
  formatTimeRange,
  isSameDay,
  minutesOfDay,
  snapMinutes,
  startOfDay,
  weekNumber,
} from '../core/date-utils';
import { isAllDayLike, isToday, layoutDayColumn, layoutSpans } from '../core/layout';
import { SchedulerOccurrence } from '../core/models';
import { SchEventContent } from '../components/event-content';
import { SchEventPopoverTrigger } from '../components/popover';
import { trackPointer } from '../interaction/pointer';
import { SchedulerStore } from '../state/scheduler-store';

interface TimedSelection {
  dayIndex: number;
  from: number; // minutes
  to: number;
  valid: boolean;
}

interface Band {
  top: number;
  height: number;
}

/** Day and week views: all-day band on top, scrollable time grid below. */
@Component({
  selector: 'sch-time-grid-view',
  imports: [SchEventContent, SchEventPopoverTrigger, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sch-tg', '[style.--sch-days]': 'days().length' },
  template: `
    <div class="sch-tg__inner">
      <div class="sch-tg__head" role="row">
        <div class="sch-tg__gutter sch-tg__corner" aria-hidden="true">
          @if (opts().weekNumbers) {
            <span class="sch-tg__weeknum">{{ store.label('weekShort') }}{{ weekNo() }}</span>
          }
        </div>
        @for (day of days(); track day.getTime()) {
          <div
            class="sch-tg__day-head"
            role="columnheader"
            [class.sch-is-today]="today(day)"
            [class.sch-is-disabled]="store.isDateDisabled(day)"
            [attr.aria-label]="longDate(day)"
          >
            @if (store.dayHeaderTemplate(); as tpl) {
              <ng-container *ngTemplateOutlet="tpl; context: { $implicit: day, view: store.view(), today: today(day) }" />
            } @else {
              <span class="sch-tg__weekday">{{ weekday(day) }}</span>
              @if (opts().navLinks && store.view() !== 'day') {
                <button type="button" class="sch-tg__daynum sch-tg__daynum--link" (click)="openDay(day)">{{ day.getDate() }}</button>
              } @else {
                <span class="sch-tg__daynum">{{ day.getDate() }}</span>
              }
            }
          </div>
        }
      </div>

      <div class="sch-tg__band" role="row">
        <div class="sch-tg__gutter sch-tg__band-label">{{ store.label('allDay') }}</div>
        <div class="sch-tg__band-body">
          <div class="sch-tg__band-cells">
            @for (day of days(); track day.getTime(); let i = $index) {
              <div
                class="sch-tg__band-cell"
                [class.sch-is-today]="today(day)"
                [class.sch-is-disabled]="store.isDateDisabled(day)"
                [class.sch-is-selected]="bandSelected(i)"
                [attr.data-sch-band-col]="i"
                (pointerdown)="onBandDown($event, i)"
              ></div>
            }
          </div>
          <div class="sch-tg__band-events" [style.--sch-lanes]="bandLanes()">
            @for (seg of band(); track seg.occ.key) {
              <div
                class="sch-event sch-event--span"
                role="button"
                tabindex="0"
                [class]="seg.occ.event.className ?? ''"
                [class.sch-event--cont-before]="seg.continuesBefore"
                [class.sch-event--cont-after]="seg.continuesAfter"
                [class.sch-is-dragging]="isDragging(seg.occ)"
                [class.sch-is-invalid]="isInvalid(seg.occ)"
                [style.--sch-event-color]="store.colorOf(seg.occ)"
                [style.--sch-event-text]="seg.occ.event.textColor ?? null"
                [style.--sch-event-border]="seg.occ.event.borderColor ?? null"
                [style.grid-column]="seg.startCol + 1 + ' / span ' + seg.span"
                [style.grid-row]="seg.lane + 1"
                [attr.aria-label]="aria(seg.occ)"
                [schEventPopover]="seg.occ"
                (pointerdown)="onBandEventDown($event, seg.occ)"
                (dblclick)="store.eventDblclick(seg.occ, $event, $any($event.currentTarget))"
                (keydown.enter)="click(seg.occ, $event)"
                (keydown.space)="click(seg.occ, $event)"
              >
                <sch-event-content [occ]="seg.occ" [compact]="true" [showTime]="false" />
              </div>
            }
          </div>
        </div>
      </div>

      <div class="sch-tg__scroll">
        <div
          class="sch-tg__body"
          role="grid"
          [attr.aria-label]="store.title()"
          [style.--sch-slots]="slots().length"
          [style.--sch-slot-ratio]="opts().slotDuration / 60"
        >
          <div class="sch-tg__times" aria-hidden="true">
            @for (h of hourMarks(); track h.minutes; let first = $first) {
              <div class="sch-tg__time" [class.sch-tg__time--first]="first && pct(h.minutes) < 1" [style.top.%]="pct(h.minutes)">{{ h.label }}</div>
            }
          </div>
          @for (day of days(); track day.getTime(); let di = $index) {
            <div
              class="sch-tg__col"
              role="row"
              [class.sch-is-today]="today(day)"
              [class.sch-is-weekend]="day.getDay() === 0 || day.getDay() === 6"
              [class.sch-is-disabled]="store.isDateDisabled(day)"
              [attr.data-sch-col]="di"
              (pointerdown)="onColDown($event, di)"
            >
              @for (nb of nonBusiness()[di]; track $index) {
                <div class="sch-tg__nonbusiness" aria-hidden="true" [style.top.%]="nb.top" [style.height.%]="nb.height"></div>
              }
              @for (s of slots(); track s) {
                <div
                  class="sch-tg__slot"
                  role="gridcell"
                  [class.sch-tg__slot--hour]="slotIsHour(s)"
                  [attr.data-sch-slot]="di + '-' + s"
                  [attr.tabindex]="focus().day === di && focus().slot === s ? 0 : -1"
                  [attr.aria-label]="slotLabel(day, s)"
                  (focus)="focus.set({ day: di, slot: s })"
                  (keydown)="onSlotKey($event, di, s)"
                ></div>
              }

              @if (selectionIn(di); as sel) {
                <div
                  class="sch-tg__selection"
                  [class.sch-is-invalid]="!sel.valid"
                  [style.top.%]="pct(sel.from)"
                  [style.height.%]="pctSpan(sel.to - sel.from)"
                ></div>
              }

              @for (seg of columns()[di]; track seg.occ.key) {
                <div
                  class="sch-event sch-event--timed"
                  role="button"
                  tabindex="0"
                  [class]="seg.occ.event.className ?? ''"
                  [class.sch-event--clip-start]="seg.clippedStart"
                  [class.sch-event--clip-end]="seg.clippedEnd"
                  [class.sch-event--short]="seg.height < shortThreshold()"
                  [class.sch-is-dragging]="isDragging(seg.occ)"
                  [class.sch-is-invalid]="isInvalid(seg.occ)"
                  [style.--sch-event-color]="store.colorOf(seg.occ)"
                  [style.--sch-event-text]="seg.occ.event.textColor ?? null"
                  [style.--sch-event-border]="seg.occ.event.borderColor ?? null"
                  [style.top.%]="seg.top"
                  [style.height.%]="seg.height"
                  [style.left.%]="seg.left"
                  [style.width.%]="seg.width"
                  [attr.aria-label]="aria(seg.occ)"
                  [schEventPopover]="seg.occ"
                  (pointerdown)="onEventDown($event, seg.occ, 'move')"
                  (dblclick)="store.eventDblclick(seg.occ, $event, $any($event.currentTarget))"
                  (keydown.enter)="click(seg.occ, $event)"
                  (keydown.space)="click(seg.occ, $event)"
                >
                  <sch-event-content [occ]="seg.occ" [compact]="seg.height < shortThreshold()" />
                  @if (store.canResize(seg.occ) && !seg.clippedEnd) {
                    <div class="sch-event__resize" aria-hidden="true" (pointerdown)="onEventDown($event, seg.occ, 'resize')"></div>
                  }
                </div>
              }

              @if (opts().nowIndicator && today(day) && nowPct() !== null) {
                <div class="sch-tg__now" [style.top.%]="nowPct()" aria-hidden="true"></div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class SchTimeGridView {
  protected readonly store = inject(SchedulerStore);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly opts = this.store.options;

  /** Visible days; week-style views honour the `daysOfWeek` filter. */
  protected readonly days = computed(() => {
    const all = eachDay(this.store.range().start, this.store.range().end);
    const filter = this.opts().daysOfWeek;
    if (!filter || this.store.view() === 'day') return all;
    const kept = all.filter((d) => filter.includes(d.getDay()));
    return kept.length ? kept : all;
  });

  private readonly winStart = computed(() => this.opts().slotMinTime);
  private readonly winEnd = computed(() => this.opts().slotMaxTime);
  private readonly windowMinutes = computed(() => this.winEnd() - this.winStart());

  protected readonly slots = computed(() =>
    Array.from({ length: Math.ceil(this.windowMinutes() / this.opts().slotDuration) }, (_, i) => i),
  );

  /** Hour labels positioned on full hours inside the window. */
  protected readonly hourMarks = computed(() => {
    const marks: { minutes: number; label: string }[] = [];
    for (let m = Math.ceil(this.winStart() / 60) * 60; m < this.winEnd(); m += 60) {
      marks.push({ minutes: m, label: formatHour(m / 60, this.opts().locale) });
    }
    return marks;
  });

  protected readonly weekNo = computed(() =>
    weekNumber(this.days()[0], this.opts().weekNumbering, this.opts().firstDayOfWeek),
  );

  /** Segments shorter than ~2 slots render compactly (single line). */
  protected readonly shortThreshold = computed(() => ((this.opts().slotDuration * 1.6) / this.windowMinutes()) * 100);

  private readonly timedOccs = computed(() => this.store.displayOccurrences().filter((o) => !isAllDayLike(o)));
  protected readonly columns = computed(() => {
    const occs = this.timedOccs();
    const startHour = this.winStart() / 60;
    const endHour = this.winEnd() / 60;
    return this.days().map((d) => layoutDayColumn(occs, d, startHour, endHour));
  });

  /** Band columns are the visible days; multi-day bars are clipped to the filtered set. */
  protected readonly band = computed(() => {
    const days = this.days();
    const contiguous = days.length === 1 || days.every((d, i) => i === 0 || +addDays(days[i - 1], 1) === +d);
    const allDay = this.store.displayOccurrences().filter(isAllDayLike);
    if (contiguous) return layoutSpans(allDay, days[0], days.length);
    // Filtered (non-contiguous) days: place bars per visible day index.
    return days.flatMap((d, i) =>
      layoutSpans(allDay, d, 1).map((s) => ({ ...s, startCol: i, continuesBefore: s.continuesBefore, lane: s.lane })),
    );
  });
  protected readonly bandLanes = computed(() => Math.max(1, ...this.band().map((s) => s.lane + 1)));

  /** Shaded intervals outside business hours, per day column. */
  protected readonly nonBusiness = computed<Band[][]>(() => {
    const o = this.opts();
    if (!o.showBusinessHours || !o.businessHours.length) return this.days().map(() => []);
    const w0 = this.winStart();
    const w1 = this.winEnd();
    return this.days().map((d) => {
      const open = o.businessHours
        .filter((b) => b.daysOfWeek.includes(d.getDay()))
        .map((b) => [Math.max(w0, this.toMin(b.startTime)), Math.min(w1, this.toMin(b.endTime))] as const)
        .filter(([a, b]) => b > a)
        .sort((x, y) => x[0] - y[0]);
      const out: Band[] = [];
      let cursor = w0;
      for (const [a, b] of open) {
        if (a > cursor) out.push({ top: this.pct(cursor), height: this.pctSpan(a - cursor) });
        cursor = Math.max(cursor, b);
      }
      if (cursor < w1) out.push({ top: this.pct(cursor), height: this.pctSpan(w1 - cursor) });
      return out;
    });
  });

  private readonly liveSelection = signal<TimedSelection | null>(null);
  private readonly bandSelection = signal<{ from: number; to: number } | null>(null);
  protected readonly focus = signal({ day: 0, slot: 0 });

  private readonly now = signal(new Date());
  protected readonly nowPct = computed(() => {
    const m = minutesOfDay(this.now()) - this.winStart();
    return m < 0 || m > this.windowMinutes() ? null : (m / this.windowMinutes()) * 100;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      clearInterval(timer);
      timer = setInterval(() => this.now.set(new Date()), this.opts().nowIndicatorInterval);
    });
    destroyRef.onDestroy(() => clearInterval(timer));

    const initialSlot = Math.max(0, Math.floor((this.opts().scrollTime - this.winStart()) / this.opts().slotDuration));
    this.focus.set({ day: Math.max(0, this.days().findIndex((d) => isToday(d))), slot: Math.min(initialSlot, this.slots().length - 1) });

    afterNextRender(() => {
      if (this.opts().autoHeight) return;
      const scroller = this.el.nativeElement.querySelector<HTMLElement>('.sch-tg__scroll');
      const body = this.el.nativeElement.querySelector<HTMLElement>('.sch-tg__body');
      if (!scroller || !body) return;
      const frac = clamp((this.opts().scrollTime - this.winStart()) / this.windowMinutes(), 0, 1);
      scroller.scrollTop = frac * body.scrollHeight;
    });
  }

  // ---------- display helpers ----------
  private toMin(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  protected today(d: Date): boolean {
    return isToday(d, this.now());
  }
  protected weekday(d: Date): string {
    return format(d, this.opts().locale, { weekday: 'short' });
  }
  protected longDate(d: Date): string {
    return format(d, this.opts().locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  protected slotIsHour(s: number): boolean {
    return (this.winStart() + s * this.opts().slotDuration) % 60 === 0;
  }
  protected slotLabel(day: Date, slot: number): string {
    const m = this.winStart() + slot * this.opts().slotDuration;
    return `${this.longDate(day)}, ${formatTimeRange(atMinutes(day, m), atMinutes(day, m + this.opts().slotDuration), this.opts().locale)}`;
  }
  protected aria(o: SchedulerOccurrence): string {
    const when = o.event.allDay ? this.store.label('allDay') : formatTimeRange(o.start, o.end, this.opts().locale);
    return `${o.event.title}, ${when}`;
  }
  protected pct(minutes: number): number {
    return ((minutes - this.winStart()) / this.windowMinutes()) * 100;
  }
  protected pctSpan(minutes: number): number {
    return (minutes / this.windowMinutes()) * 100;
  }
  protected bandSelected(i: number): boolean {
    const live = this.bandSelection();
    if (live) return i >= Math.min(live.from, live.to) && i <= Math.max(live.from, live.to);
    const sel = this.store.selection();
    if (!sel?.allDay) return false;
    const d = this.days()[i];
    return d >= startOfDay(sel.start) && d < sel.end;
  }
  /** Live drag selection, or the persisted timed selection, within a column. */
  protected selectionIn(dayIndex: number): TimedSelection | null {
    const live = this.liveSelection();
    if (live) return live.dayIndex === dayIndex ? live : null;
    const sel = this.store.selection();
    const day = this.days()[dayIndex];
    if (!sel || sel.allDay || !isSameDay(sel.start, day)) return null;
    const to = isSameDay(sel.end, day) ? minutesOfDay(sel.end) : 1440;
    return { dayIndex, from: minutesOfDay(sel.start), to, valid: true };
  }
  protected isDragging(o: SchedulerOccurrence): boolean {
    return this.store.drag()?.key === o.key;
  }
  protected isInvalid(o: SchedulerOccurrence): boolean {
    const d = this.store.drag();
    return !!d && d.key === o.key && !d.valid;
  }

  protected openDay(day: Date): void {
    this.store.setDate(day);
    this.store.setView('day');
  }

  protected click(o: SchedulerOccurrence, e: Event): void {
    e.preventDefault();
    this.store.activateEvent(o, e, e.currentTarget as HTMLElement);
  }

  // ---------- geometry ----------
  /** Column + minutes under a point; x picks the column, y is clamped into the grid. */
  private timeAt(x: number, y: number): { dayIndex: number; minutes: number } | null {
    const cols = Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>('[data-sch-col]'));
    if (!cols.length) return null;
    let idx = cols.findIndex((c) => {
      const r = c.getBoundingClientRect();
      return x >= r.left && x < r.right;
    });
    if (idx === -1) idx = x < cols[0].getBoundingClientRect().left ? 0 : cols.length - 1;
    const r = cols[idx].getBoundingClientRect();
    const frac = clamp((y - r.top) / r.height, 0, 1);
    return { dayIndex: idx, minutes: this.winStart() + frac * this.windowMinutes() };
  }

  private bandColAt(x: number): number {
    const cells = Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>('[data-sch-band-col]'));
    const i = cells.findIndex((c) => {
      const r = c.getBoundingClientRect();
      return x >= r.left && x < r.right;
    });
    if (i !== -1) return i;
    return cells.length && x < cells[0].getBoundingClientRect().left ? 0 : cells.length - 1;
  }

  private snap(d: Date): Date {
    return atMinutes(startOfDay(d), snapMinutes(minutesOfDay(d), this.opts().snapDuration));
  }

  // ---------- interactions ----------
  protected onEventDown(e: PointerEvent, displayed: SchedulerOccurrence, kind: 'move' | 'resize'): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    const occ = this.store.original(displayed);
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>('.sch-event');
    const allowed = kind === 'move' ? this.store.canDrag(occ) : this.store.canResize(occ);
    const t0 = this.timeAt(e.clientX, e.clientY);
    if (!t0) return;
    const p0 = atMinutes(this.days()[t0.dayIndex], t0.minutes).getTime();
    const duration = occ.end.getTime() - occ.start.getTime();
    const minLen = this.opts().snapDuration * MINUTE;
    let started = false;

    trackPointer(
      e,
      {
        move: (ev) => {
          if (!allowed) return;
          const t = this.timeAt(ev.clientX, ev.clientY);
          if (!t) return;
          if (!started) {
            started = true;
            this.store.dragStart(occ, kind, el, ev);
          }
          const p = atMinutes(this.days()[t.dayIndex], t.minutes).getTime();
          if (kind === 'move') {
            const start = this.snap(new Date(occ.start.getTime() + (p - p0)));
            this.store.dragMove(occ, kind, start, new Date(start.getTime() + duration), ev);
          } else {
            let end = this.snap(new Date(occ.end.getTime() + (p - p0)));
            if (end.getTime() < occ.start.getTime() + minLen) end = new Date(occ.start.getTime() + minLen);
            this.store.dragMove(occ, kind, occ.start, end, ev);
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

  protected onBandEventDown(e: PointerEvent, displayed: SchedulerOccurrence): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    const occ = this.store.original(displayed);
    const el = e.currentTarget as HTMLElement;
    const allowed = this.store.canDrag(occ);
    const col0 = this.bandColAt(e.clientX);
    let started = false;
    trackPointer(
      e,
      {
        move: (ev) => {
          if (!allowed) return;
          if (!started) {
            started = true;
            this.store.dragStart(occ, 'move', el, ev);
          }
          const days = this.days();
          const target = days[this.bandColAt(ev.clientX)];
          const delta = Math.round((startOfDay(target).getTime() - startOfDay(days[col0]).getTime()) / 86_400_000);
          this.store.dragMove(occ, 'move', addDays(occ.start, delta), addDays(occ.end, delta), ev);
        },
        end: (ev, dragged) => {
          if (!dragged || !started) {
            this.store.drag.set(null);
            this.store.activateEvent(occ, ev, el);
            return;
          }
          this.store.dragEnd(occ, 'move', ev);
        },
        cancel: () => started && this.store.dragCancel(occ, 'move'),
      },
      this.opts().dragMinDistance,
    );
  }

  protected onColDown(e: PointerEvent, dayIndex: number): void {
    if (e.button !== 0 || this.opts().disabled) return;
    const t0 = this.timeAt(e.clientX, e.clientY);
    if (!t0) return;
    const day = this.days()[dayIndex];
    if (this.store.isDateDisabled(day)) return;
    const step = this.opts().slotDuration;
    const maxM = this.winEnd();
    const m0 = Math.floor(t0.minutes / step) * step;
    const make = (m: number): TimedSelection => {
      const from = Math.min(m0, m);
      const to = Math.min(maxM, Math.max(m0, m) + step);
      return { dayIndex, from, to, valid: this.store.isSelectionAllowed(atMinutes(day, from), atMinutes(day, to), false) };
    };
    const canSelect = this.store.canSelect();
    if (canSelect) this.liveSelection.set(make(m0));
    trackPointer(
      e,
      {
        move: (ev) => {
          if (!canSelect) return;
          const t = this.timeAt(ev.clientX, ev.clientY);
          if (t) this.liveSelection.set(make(Math.floor(t.minutes / step) * step));
        },
        end: (ev, dragged) => {
          const sel = this.liveSelection();
          this.liveSelection.set(null);
          if (!dragged) this.store.dateClick(atMinutes(day, m0), false, ev);
          if (sel?.valid) this.store.selectRange(atMinutes(day, sel.from), atMinutes(day, sel.to), false, ev);
        },
        cancel: () => this.liveSelection.set(null),
      },
      this.opts().dragMinDistance,
    );
  }

  protected onBandDown(e: PointerEvent, col: number): void {
    if (e.button !== 0 || this.opts().disabled || this.store.isDateDisabled(this.days()[col])) return;
    const canSelect = this.store.canSelect();
    if (canSelect) this.bandSelection.set({ from: col, to: col });
    trackPointer(
      e,
      {
        move: (ev) => canSelect && this.bandSelection.set({ from: col, to: this.bandColAt(ev.clientX) }),
        end: (ev, dragged) => {
          const s = this.bandSelection();
          this.bandSelection.set(null);
          const days = this.days();
          if (!dragged) this.store.dateClick(days[col], true, ev);
          if (s) this.store.selectRange(days[Math.min(s.from, s.to)], addDays(days[Math.max(s.from, s.to)], 1), true, ev);
        },
        cancel: () => this.bandSelection.set(null),
      },
      this.opts().dragMinDistance,
    );
  }

  protected onSlotKey(e: KeyboardEvent, day: number, slot: number): void {
    const last = this.slots().length - 1;
    const lastDay = this.days().length - 1;
    let next = { day, slot };
    switch (e.key) {
      case 'ArrowUp': next = { day, slot: Math.max(0, slot - 1) }; break;
      case 'ArrowDown': next = { day, slot: Math.min(last, slot + 1) }; break;
      case 'ArrowLeft':
        if (day === 0) {
          this.store.prev();
          next = { day: this.days().length - 1, slot };
        } else next = { day: day - 1, slot };
        break;
      case 'ArrowRight':
        if (day === lastDay) {
          this.store.next();
          next = { day: 0, slot };
        } else next = { day: day + 1, slot };
        break;
      case 'Home': next = { day, slot: 0 }; break;
      case 'End': next = { day, slot: last }; break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const d = this.days()[day];
        const m = this.winStart() + slot * this.opts().slotDuration;
        this.store.dateClick(atMinutes(d, m), false, e);
        this.store.selectRange(atMinutes(d, m), atMinutes(d, m + this.opts().slotDuration), false, e);
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    this.focus.set(next);
    setTimeout(() => this.el.nativeElement.querySelector<HTMLElement>(`[data-sch-slot="${next.day}-${next.slot}"]`)?.focus());
  }
}
