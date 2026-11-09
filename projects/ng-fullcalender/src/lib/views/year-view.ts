import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal } from '@angular/core';
import { addDays, format, isSameDay, startOfDay, startOfWeek, weekdayNames } from '../core/date-utils';
import { isToday, lastDay } from '../core/layout';
import { SchedulerOccurrence } from '../core/models';
import { trackPointer } from '../interaction/pointer';
import { SchedulerStore } from '../state/scheduler-store';

interface MiniMonth {
  month: Date;
  /** 6×7 cells; `null` for days outside the month. */
  cells: (Date | null)[];
}

const MAX_DOTS = 3;

/** Twelve mini-months with event indicators, today, selection and disabled states. */
@Component({
  selector: 'sch-year-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sch-year' },
  template: `
    <div class="sch-year__grid" role="grid" [attr.aria-label]="store.title()">
      @for (m of months(); track m.month.getTime()) {
        <section class="sch-year__month" [attr.aria-label]="monthName(m.month)">
          <button type="button" class="sch-year__title" tabindex="-1" (click)="openMonth(m.month)">{{ monthName(m.month) }}</button>
          <div class="sch-year__weekdays" aria-hidden="true">
            @for (w of weekdays(); track $index) {
              <span>{{ w }}</span>
            }
          </div>
          <div class="sch-year__days" role="rowgroup">
            @for (day of m.cells; track $index) {
              @if (day) {
                <button
                  type="button"
                  class="sch-year__day"
                  role="gridcell"
                  [class.sch-is-today]="today(day)"
                  [class.sch-is-weekend]="day.getDay() === 0 || day.getDay() === 6"
                  [class.sch-is-disabled]="store.isDateDisabled(day)"
                  [class.sch-is-picked]="isPicked(day)"
                  [class.sch-is-single]="isSingle(day)"
                  [class.sch-is-range-start]="isRangeEdge(day, 'start')"
                  [class.sch-is-range-end]="isRangeEdge(day, 'end')"
                  [class.sch-has-events]="dots(day).length > 0"
                  [attr.data-sch-date]="day.getTime()"
                  [attr.tabindex]="isFocused(day) ? 0 : -1"
                  [attr.aria-label]="ariaDay(day)"
                  [attr.aria-selected]="isPicked(day)"
                  [attr.aria-disabled]="store.isDateDisabled(day) || null"
                  (pointerdown)="onDown($event, day)"
                  (dblclick)="openDay(day)"
                  (focus)="focusDate.set(day)"
                  (keydown)="onKey($event, day)"
                >
                  <span class="sch-year__num">{{ day.getDate() }}</span>
                  @if (dots(day).length) {
                    <span class="sch-year__dots" aria-hidden="true">
                      @for (c of dots(day); track $index) {
                        <span class="sch-year__dot" [style.--sch-event-color]="c"></span>
                      }
                    </span>
                  }
                </button>
              } @else {
                <span class="sch-year__blank" aria-hidden="true"></span>
              }
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class SchYearView {
  protected readonly store = inject(SchedulerStore);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly opts = this.store.options;

  protected readonly weekdays = computed(() => weekdayNames(this.opts().locale, this.opts().firstDayOfWeek, 'narrow'));
  private readonly year = computed(() => this.store.range().start.getFullYear());

  protected readonly months = computed<MiniMonth[]>(() => {
    const y = this.year();
    const fdow = this.opts().firstDayOfWeek;
    return Array.from({ length: 12 }, (_, m) => {
      const first = new Date(y, m, 1);
      const gridStart = startOfWeek(first, fdow);
      const cells = Array.from({ length: 42 }, (_, i) => {
        const d = addDays(gridStart, i);
        return d.getMonth() === m ? d : null;
      });
      return { month: first, cells };
    });
  });

  /** Up to three event colors per day, keyed by local day timestamp. */
  private readonly dotMap = computed(() => {
    const map = new Map<number, string[]>();
    const accent = 'var(--sch-accent)';
    for (const o of this.store.occurrences()) {
      const color = this.store.colorOf(o) ?? accent;
      for (let d = startOfDay(o.start); d <= lastDay(o); d = addDays(d, 1)) {
        const k = d.getTime();
        const list = map.get(k) ?? [];
        if (list.length < MAX_DOTS && !list.includes(color)) list.push(color);
        map.set(k, list);
      }
    }
    return map;
  });

  private readonly countMap = computed(() => {
    const map = new Map<number, number>();
    for (const o of this.store.occurrences()) {
      for (let d = startOfDay(o.start); d <= lastDay(o); d = addDays(d, 1)) map.set(d.getTime(), (map.get(d.getTime()) ?? 0) + 1);
    }
    return map;
  });

  protected readonly focusDate = signal<Date>(this.initialFocus());
  private readonly live = signal<{ from: Date; to: Date } | null>(null);

  private initialFocus(): Date {
    const t = new Date();
    return t.getFullYear() === this.store.date().getFullYear() ? startOfDay(t) : new Date(this.store.date().getFullYear(), 0, 1);
  }

  protected dots(d: Date): string[] {
    return this.dotMap().get(d.getTime()) ?? [];
  }
  protected today(d: Date): boolean {
    return isToday(d);
  }
  protected isFocused(d: Date): boolean {
    return isSameDay(d, this.focusDate());
  }
  private selectedRange(): { from: Date; to: Date } | null {
    const live = this.live();
    if (live) return live.from <= live.to ? live : { from: live.to, to: live.from };
    const s = this.store.selection();
    return s ? { from: startOfDay(s.start), to: addDays(s.end, -1) } : null;
  }
  protected isPicked(d: Date): boolean {
    const r = this.selectedRange();
    return !!r && d >= r.from && d <= startOfDay(r.to);
  }
  /** The only selected day (not part of a multi-day range). */
  protected isSingle(d: Date): boolean {
    const r = this.selectedRange();
    return !!r && isSameDay(r.from, r.to) && isSameDay(d, r.from);
  }

  protected isRangeEdge(d: Date, edge: 'start' | 'end'): boolean {
    const r = this.selectedRange();
    if (!r || isSameDay(r.from, r.to)) return false;
    return isSameDay(d, edge === 'start' ? r.from : r.to);
  }
  protected monthName(d: Date): string {
    return format(d, this.opts().locale, { month: 'long' });
  }
  protected ariaDay(d: Date): string {
    const n = this.countMap().get(d.getTime()) ?? 0;
    const date = format(d, this.opts().locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return n ? `${date}, ${this.store.label('eventCount', n)}` : date;
  }

  protected openMonth(d: Date): void {
    this.store.setDate(d);
    this.store.setView('month');
  }

  protected openDay(d: Date): void {
    if (this.store.isDateDisabled(d)) return;
    this.store.setDate(d);
    this.store.setView('day');
  }

  private dayAt(x: number, y: number): Date | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-sch-date]');
    return el && this.el.nativeElement.contains(el) ? new Date(Number(el.dataset['schDate'])) : null;
  }

  protected onDown(e: PointerEvent, day: Date): void {
    if (e.button !== 0 || this.opts().disabled || this.store.isDateDisabled(day)) return;
    const canSelect = this.store.canSelect();
    if (canSelect) this.live.set({ from: day, to: day });
    trackPointer(
      e,
      {
        move: (ev) => {
          const d = this.dayAt(ev.clientX, ev.clientY);
          if (canSelect && d) this.live.set({ from: day, to: d });
        },
        end: (ev, dragged) => {
          const r = this.selectedRange();
          this.live.set(null);
          if (!dragged) this.store.dateClick(day, true, ev);
          if (r && canSelect) this.store.selectRange(r.from, addDays(r.to, 1), true, ev);
        },
        cancel: () => this.live.set(null),
      },
      this.opts().dragMinDistance,
    );
  }

  protected onKey(e: KeyboardEvent, day: Date): void {
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
    if (next.getFullYear() !== this.year()) this.store.setDate(next);
    setTimeout(() => this.el.nativeElement.querySelector<HTMLElement>(`[data-sch-date="${next.getTime()}"]`)?.focus());
  }
}
