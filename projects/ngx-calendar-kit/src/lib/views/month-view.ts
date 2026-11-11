import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { addDays, diffDays, eachDay, format, formatTimeRange, isSameDay, startOfDay, weekNumber, weekdayNames } from '../core/date-utils';
import { SpanSegment, isAllDayLike, isToday, layoutSpans, occurrencesOnDay } from '../core/layout';
import { SchedulerOccurrence } from '../core/models';
import { NgxCalendarEventContent } from '../components/event-content';
import { NgxCalendarEventPopoverTrigger } from '../components/popover';
import { trackPointer } from '../interaction/pointer';
import { SchedulerStore } from '../state/scheduler-store';

interface WeekRow {
  start: Date;
  days: Date[];
  weekNo: number;
  visible: SpanSegment[];
  /** Hidden occurrences per day column (listed by "+N more"). */
  hidden: SchedulerOccurrence[][];
}

/** Lane, day-number row and "+N more" row heights (px) at the default token values. */
const FALLBACK = { lane: 24, head: 36, more: 22 };

@Component({
  selector: 'ngx-calendar-month-view',
  imports: [NgxCalendarEventContent, NgxCalendarEventPopoverTrigger, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ngx-calendar-month',
    '[class.ngx-calendar-month--weeknums]': 'opts().weekNumbers',
    '[style.--ngx-calendar-month-rows]': 'lanes()',
  },
  template: `
    <div class="ngx-calendar-month__head" role="row">
      @if (opts().weekNumbers) {
        <div class="ngx-calendar-month__weeknum-head" aria-hidden="true"></div>
      }
      @for (name of weekdays(); track $index) {
        <div class="ngx-calendar-month__weekday" role="columnheader">{{ name }}</div>
      }
    </div>
    <div class="ngx-calendar-month__grid" role="grid" [attr.aria-label]="store.title()">
      @for (week of weeks(); track week.start.getTime()) {
        <div class="ngx-calendar-month__week" role="row">
          @if (opts().weekNumbers) {
            <div class="ngx-calendar-month__weeknum" aria-hidden="true">{{ week.weekNo }}</div>
          }
          @for (day of week.days; track day.getTime(); let i = $index) {
            <div
              class="ngx-calendar-month__cell"
              role="gridcell"
              [style.grid-column]="i + col0()"
              [class.ngx-calendar-month__cell--last]="i === 6"
              [class.ngx-calendar-is-weekend]="day.getDay() === 0 || day.getDay() === 6"
              [class.ngx-calendar-is-today]="today(day)"
              [class.ngx-calendar-is-outside]="day.getMonth() !== anchorMonth()"
              [class.ngx-calendar-is-disabled]="store.isDateDisabled(day)"
              [class.ngx-calendar-is-selected]="isLiveSelected(day)"
              [class.ngx-calendar-is-picked]="isPicked(day)"
              [class.ngx-calendar-is-expanded]="isExpanded(day)"
              [attr.data-ngx-calendar-date]="day.getTime()"
              [attr.tabindex]="isFocused(day) ? 0 : -1"
              [attr.aria-label]="longDate(day)"
              [attr.aria-selected]="isPicked(day)"
              [attr.aria-disabled]="store.isDateDisabled(day) || null"
              (pointerdown)="onCellDown($event, day)"
              (focus)="focusDate.set(day)"
              (keydown)="onCellKey($event, day)"
            ></div>
            <div class="ngx-calendar-month__daynum" [style.grid-column]="i + col0()">
              @if (store.dayHeaderTemplate(); as tpl) {
                <ng-container *ngTemplateOutlet="tpl; context: { $implicit: day, view: store.view(), today: today(day) }" />
              } @else if (opts().navLinks) {
                <button type="button" tabindex="-1" class="ngx-calendar-month__daynum-btn" (click)="openDay(day)">{{ day.getDate() }}</button>
              } @else {
                <span class="ngx-calendar-month__daynum-btn">{{ day.getDate() }}</span>
              }
            </div>
            @if (week.hidden[i].length > 0) {
              <button
                type="button"
                class="ngx-calendar-month__more"
                data-ngx-calendar-popover-toggle
                [style.grid-column]="i + col0()"
                [style.grid-row]="lanes() + 2"
                [class.ngx-calendar-is-active]="isExpanded(day)"
                [attr.aria-haspopup]="opts().showMorePopover ? 'dialog' : null"
                [attr.aria-expanded]="opts().showMorePopover ? isExpanded(day) : null"
                (pointerdown)="$event.stopPropagation()"
                (click)="more(day, week.hidden[i], $event)"
              >
                {{ store.label('more', week.hidden[i].length) }}
              </button>
            }
          }
          @for (seg of week.visible; track seg.occ.key) {
            <div
              class="ngx-calendar-event"
              role="button"
              tabindex="0"
              [class]="seg.occ.event.className ?? ''"
              [class.ngx-calendar-event--span]="isBar(seg.occ)"
              [class.ngx-calendar-event--dot]="!isBar(seg.occ)"
              [class.ngx-calendar-event--cont-before]="seg.continuesBefore"
              [class.ngx-calendar-event--cont-after]="seg.continuesAfter"
              [class.ngx-calendar-is-dragging]="isDragging(seg.occ)"
              [class.ngx-calendar-is-invalid]="isInvalid(seg.occ)"
              [style.--ngx-calendar-event-color]="store.colorOf(seg.occ)"
              [style.--ngx-calendar-event-text]="seg.occ.event.textColor ?? null"
              [style.--ngx-calendar-event-border]="seg.occ.event.borderColor ?? null"
              [style.grid-column]="seg.startCol + col0() + ' / span ' + seg.span"
              [style.grid-row]="seg.lane + 2"
              [attr.aria-label]="aria(seg.occ)"
              [ngxCalendarEventPopover]="seg.occ"
              (pointerdown)="onEventDown($event, seg.occ)"
              (dblclick)="store.eventDblclick(seg.occ, $event, $any($event.currentTarget))"
              (keydown.enter)="click(seg.occ, $event)"
              (keydown.space)="click(seg.occ, $event)"
            >
              <ngx-calendar-event-content [occ]="seg.occ" [compact]="true" [showTime]="!isBar(seg.occ)" />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class NgxCalendarMonthView {
  protected readonly store = inject(SchedulerStore);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly opts = this.store.options;

  /** Lanes that fit the measured row height (fixed-height mode). */
  private readonly fitLanes = signal<number | null>(null);

  /** Event rows per cell: what fits, capped by `maxEventsVisible` (auto height: the cap). */
  protected readonly lanes = computed(() => {
    const cap = this.opts().maxEventsVisible;
    const fit = this.fitLanes();
    return this.opts().autoHeight || fit === null ? cap : Math.max(1, Math.min(cap, fit));
  });

  /** First day column (week numbers take column 1). */
  protected readonly col0 = computed(() => (this.opts().weekNumbers ? 2 : 1));

  protected readonly anchorMonth = computed(() => this.store.date().getMonth());
  protected readonly weekdays = computed(() => weekdayNames(this.opts().locale, this.opts().firstDayOfWeek));
  private readonly allDays = computed(() => eachDay(this.store.range().start, this.store.range().end));

  protected readonly weeks = computed<WeekRow[]>(() => {
    const days = this.allDays();
    const occs = this.store.displayOccurrences();
    const max = this.lanes();
    const o = this.opts();
    const rows: WeekRow[] = [];
    for (let w = 0; w < days.length; w += 7) {
      const weekDays = days.slice(w, w + 7);
      const segs = layoutSpans(occs, weekDays[0], weekDays.length);
      const hidden: SchedulerOccurrence[][] = weekDays.map(() => []);
      const visible: SpanSegment[] = [];
      for (const s of segs) {
        if (s.lane < max) visible.push(s);
        else for (let c = s.startCol; c < s.startCol + s.span; c++) hidden[c].push(s.occ);
      }
      rows.push({
        start: weekDays[0],
        days: weekDays,
        weekNo: weekNumber(weekDays[0], o.weekNumbering, o.firstDayOfWeek),
        visible,
        hidden,
      });
    }
    return rows;
  });

  protected readonly focusDate = signal<Date>(this.initialFocus());
  private readonly liveSelection = signal<{ from: Date; to: Date } | null>(null);
  private readonly now = signal(new Date());

  constructor() {
    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setInterval> | undefined;
    effect(() => {
      clearInterval(timer);
      timer = setInterval(() => this.now.set(new Date()), this.opts().nowIndicatorInterval);
    });
    destroyRef.onDestroy(() => clearInterval(timer));

    // Fit event rows to the available row height.
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const grid = this.el.nativeElement.querySelector<HTMLElement>('.ngx-calendar-month__grid');
      if (!grid) return;
      const measure = () => {
        const weeks = this.weeks().length || 6;
        const cs = getComputedStyle(this.el.nativeElement);
        const px = (name: string, fallback: number) => this.toPx(cs.getPropertyValue(name), fallback);
        const rowH = grid.clientHeight / weeks;
        const lanes = Math.floor((rowH - px('--ngx-calendar-month-head', FALLBACK.head) - FALLBACK.more) / px('--ngx-calendar-month-lane', FALLBACK.lane));
        this.fitLanes.set(rowH > 0 ? Math.max(1, lanes) : null);
      };
      const ro = new ResizeObserver(measure);
      ro.observe(grid);
      measure();
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  private toPx(v: string, fallback: number): number {
    const t = v.trim();
    if (t.endsWith('rem')) return parseFloat(t) * parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
    if (t.endsWith('px')) return parseFloat(t);
    return fallback;
  }

  private initialFocus(): Date {
    const d = this.store.date();
    const t = new Date();
    return t.getMonth() === d.getMonth() && t.getFullYear() === d.getFullYear() ? t : new Date(d.getFullYear(), d.getMonth(), 1);
  }

  protected today(d: Date): boolean {
    return isToday(d, this.now());
  }
  protected isFocused(d: Date): boolean {
    return isSameDay(d, this.focusDate());
  }
  protected isLiveSelected(d: Date): boolean {
    const s = this.liveSelection();
    if (!s) return false;
    const [a, b] = s.from <= s.to ? [s.from, s.to] : [s.to, s.from];
    return d >= a && d <= b;
  }
  /** Inside the persisted selection (single day or range). */
  protected isPicked(d: Date): boolean {
    if (this.liveSelection()) return false;
    const s = this.store.selection();
    return !!s && d >= startOfDay(s.start) && d < s.end;
  }
  protected isExpanded(day: Date): boolean {
    const p = this.store.popover();
    return p?.kind === 'day' && isSameDay(p.date, day);
  }
  protected isBar(o: SchedulerOccurrence): boolean {
    return isAllDayLike(o);
  }
  protected isDragging(o: SchedulerOccurrence): boolean {
    return this.store.drag()?.key === o.key;
  }
  protected isInvalid(o: SchedulerOccurrence): boolean {
    const d = this.store.drag();
    return !!d && d.key === o.key && !d.valid;
  }
  protected longDate(d: Date): string {
    const count = occurrencesOnDay(this.store.occurrences(), d).length;
    return `${format(d, this.opts().locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${count ? `, ${this.store.label('eventCount', count)}` : ''}`;
  }
  protected aria(o: SchedulerOccurrence): string {
    const when = o.event.allDay ? this.store.label('allDay') : formatTimeRange(o.start, o.end, this.opts().locale);
    return `${o.event.title}, ${when}`;
  }

  protected openDay(day: Date): void {
    this.store.setDate(day);
    this.store.setView('day');
  }

  protected more(day: Date, hidden: SchedulerOccurrence[], e: Event): void {
    if (this.isExpanded(day)) {
      this.store.closePopover();
      return;
    }
    this.store.more(e.currentTarget as HTMLElement, day, hidden, occurrencesOnDay(this.store.occurrences(), day), e, 'month');
  }

  protected click(o: SchedulerOccurrence, e: Event): void {
    e.preventDefault();
    this.store.activateEvent(o, e, e.currentTarget as HTMLElement);
  }

  /** Day cell under a point (by geometry, so it works over event bars). */
  private dayAt(x: number, y: number): Date | null {
    for (const c of Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>('[data-ngx-calendar-date]'))) {
      const r = c.getBoundingClientRect();
      if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) return new Date(Number(c.getAttribute('data-ngx-calendar-date')));
    }
    return null;
  }

  protected onEventDown(e: PointerEvent, displayed: SchedulerOccurrence): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    const occ = this.store.original(displayed);
    const el = e.currentTarget as HTMLElement;
    const allowed = this.store.canDrag(occ);
    const d0 = this.dayAt(e.clientX, e.clientY);
    let started = false;
    trackPointer(
      e,
      {
        move: (ev) => {
          const d = this.dayAt(ev.clientX, ev.clientY);
          if (!allowed || !d0 || !d) return;
          if (!started) {
            started = true;
            this.store.dragStart(occ, 'move', el, ev);
          }
          const delta = diffDays(d0, d);
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

  protected onCellDown(e: PointerEvent, day: Date): void {
    if (e.button !== 0 || this.opts().disabled || this.store.isDateDisabled(day)) return;
    const canSelect = this.store.canSelect();
    if (canSelect) this.liveSelection.set({ from: day, to: day });
    trackPointer(
      e,
      {
        move: (ev) => {
          const d = this.dayAt(ev.clientX, ev.clientY);
          if (canSelect && d) this.liveSelection.set({ from: day, to: d });
        },
        end: (ev, dragged) => {
          const s = this.liveSelection();
          this.liveSelection.set(null);
          if (!dragged) this.store.dateClick(day, true, ev);
          if (!s) return;
          const [a, b] = s.from <= s.to ? [s.from, s.to] : [s.to, s.from];
          this.store.selectRange(a, addDays(b, 1), true, ev);
        },
        cancel: () => this.liveSelection.set(null),
      },
      this.opts().dragMinDistance,
    );
  }

  protected onCellKey(e: KeyboardEvent, day: Date): void {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (this.store.isDateDisabled(day)) return;
      this.store.dateClick(day, true, e);
      this.store.selectRange(day, addDays(day, 1), true, e);
      return;
    }
    const delta = deltas[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = addDays(day, delta);
    this.focusDate.set(next);
    const { start, end } = this.store.range();
    if (next < start || next >= end || next.getMonth() !== this.anchorMonth()) this.store.setDate(next);
    setTimeout(() => this.el.nativeElement.querySelector<HTMLElement>(`[data-ngx-calendar-date="${next.getTime()}"]`)?.focus());
  }
}
