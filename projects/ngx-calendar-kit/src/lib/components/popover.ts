import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
} from '@angular/core';
import { addDays, diffDays, format, formatTimeRange, isSameDay } from '../core/date-utils';
import { lastDay } from '../core/layout';
import { SchedulerOccurrence } from '../core/models';
import { SchedulerStore } from '../state/scheduler-store';

const canHover = () => typeof matchMedia === 'function' && matchMedia('(hover: hover)').matches;

/** Wires an event element to the details popover (hover/focus preview; hides on press). */
@Directive({
  selector: '[ngxCalendarEventPopover]',
  host: {
    '(mouseenter)': 'enter($event)',
    '(mouseleave)': 'leave($event)',
    '(focus)': 'focus()',
    '(blur)': 'store.releasePreview()',
    '(pointerdown)': 'store.closePopover()',
    '[attr.aria-describedby]': 'describedBy()',
    '[attr.aria-expanded]': 'pinned()',
  },
})
export class NgxCalendarEventPopoverTrigger {
  protected readonly store = inject(SchedulerStore);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly occurrence = input.required<SchedulerOccurrence>({ alias: 'ngxCalendarEventPopover' });

  private readonly mine = computed(() => {
    const p = this.store.popover();
    return p?.kind === 'event' && p.occurrence.key === this.occurrence().key ? p : null;
  });
  protected readonly describedBy = computed(() => (this.mine() ? this.store.popoverId : null));
  protected readonly pinned = computed(() => (this.store.options().eventPopover ? !!this.mine()?.sticky : null));

  protected enter(e: MouseEvent): void {
    this.store.eventMouse('enter', this.occurrence(), this.el.nativeElement, e);
    if (canHover()) this.store.previewEvent(this.el.nativeElement, this.occurrence());
  }

  protected leave(e: MouseEvent): void {
    this.store.eventMouse('leave', this.occurrence(), this.el.nativeElement, e);
    this.store.releasePreview();
  }

  protected focus(): void {
    if (this.el.nativeElement.matches(':focus-visible')) this.store.previewEvent(this.el.nativeElement, this.occurrence(), true);
  }
}

/** Single floating popover per scheduler, rendered by the root. */
@Component({
  selector: 'ngx-calendar-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ngx-calendar-popover',
    '[id]': 'store.popoverId',
    '[attr.role]': "state()?.sticky ? 'dialog' : 'tooltip'",
    '[attr.aria-label]': 'ariaLabel()',
    '[class.ngx-calendar-is-open]': '!!state()',
    '[class.ngx-calendar-popover--day]': "state()?.kind === 'day'",
    '[class.ngx-calendar-popover--event]': "state()?.kind === 'event'",
    '(mouseenter)': 'store.cancelHide()',
    '(mouseleave)': 'store.releasePreview()',
  },
  template: `
    @if (state(); as s) {
      @if (s.kind === 'event') {
        @let o = s.occurrence;
        <div class="ngx-calendar-popover__event" [style.--ngx-calendar-event-color]="store.colorOf(o)">
          <header class="ngx-calendar-popover__header">
            <span class="ngx-calendar-popover__bar" aria-hidden="true"></span>
            <div class="ngx-calendar-popover__heading">
              <div class="ngx-calendar-popover__title">{{ o.event.title }}</div>
              @if (subtitle(o); as sub) {
                <div class="ngx-calendar-popover__subtitle">{{ sub }}</div>
              }
            </div>
            <button type="button" class="ngx-calendar-popover__close" [attr.aria-label]="store.label('close')" (click)="store.closePopover()">
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" /></svg>
            </button>
          </header>
          <dl class="ngx-calendar-popover__rows">
            <div class="ngx-calendar-popover__row">
              <dt class="ngx-calendar-visually-hidden">{{ store.label('time') }}</dt>
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.75" /><path d="M8 5v3.25l2 1.25" /></svg>
              <dd>{{ timeText(o) }}</dd>
            </div>
            <div class="ngx-calendar-popover__row">
              <dt class="ngx-calendar-visually-hidden">{{ store.label('date') }}</dt>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
              </svg>
              <dd>{{ dateText(o) }}</dd>
            </div>
            <div class="ngx-calendar-popover__row">
              <dt class="ngx-calendar-visually-hidden">{{ store.label('durationLabel') }}</dt>
              <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="9" r="5" /><path d="M8 9V6.75M6.5 2h3M12 4.5l1-1" /></svg>
              <dd>{{ durationText(o) }}</dd>
            </div>
            @if (o.recurring) {
              <div class="ngx-calendar-popover__row">
                <dt class="ngx-calendar-visually-hidden">{{ store.label('repeats') }}</dt>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3 6.5A5 5 0 0 1 12.5 5M13 9.5A5 5 0 0 1 3.5 11M12.5 2v3h-3M3.5 14v-3h3" />
                </svg>
                <dd>{{ store.label('repeats') }}</dd>
              </div>
            }
          </dl>
        </div>
      } @else {
        <header class="ngx-calendar-popover__dayhead">
          <div>
            <div class="ngx-calendar-popover__daytitle">{{ dayTitle(s.date) }}</div>
            <div class="ngx-calendar-popover__daycount">{{ store.label('eventCount', s.occurrences.length) }}</div>
          </div>
          <button type="button" class="ngx-calendar-popover__close" [attr.aria-label]="store.label('close')" (click)="store.closePopover()">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" /></svg>
          </button>
        </header>
        <ul class="ngx-calendar-popover__list" role="list">
          @for (o of s.occurrences; track o.key) {
            <li>
              <button
                type="button"
                class="ngx-calendar-popover__item"
                [style.--ngx-calendar-event-color]="store.colorOf(o)"
                [attr.aria-label]="o.event.title + ', ' + timeText(o)"
                (click)="pick(o, $event)"
              >
                <span class="ngx-calendar-popover__dot" aria-hidden="true"></span>
                <span class="ngx-calendar-popover__item-title">{{ o.event.title }}</span>
              </button>
            </li>
          }
        </ul>
      }
    }
  `,
})
export class NgxCalendarPopover {
  protected readonly store = inject(SchedulerStore);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly state = this.store.popover;
  private readonly locale = computed(() => this.store.options().locale);

  protected readonly ariaLabel = computed(() => {
    const s = this.state();
    if (!s) return null;
    return s.kind === 'day' ? this.dayTitle(s.date) : s.occurrence.event.title;
  });

  constructor() {
    afterRenderEffect({ write: () => this.position() });

    // Close: outside press (pinned), Escape, scrolling outside the popover, resize.
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      // Toggles (e.g. "+N more") manage open/close themselves.
      if (target?.closest?.('[data-ngx-calendar-popover-toggle]')) return;
      if (this.state()?.sticky && !this.el.nativeElement.contains(target)) this.store.closePopover();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.state()) this.store.closePopover();
    };
    const onScroll = (e: Event) => {
      if (this.state() && !this.el.nativeElement.contains(e.target as Node)) this.store.closePopover();
    };
    const onResize = () => this.state() && this.store.closePopover();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    inject(DestroyRef).onDestroy(() => {
      this.store.closePopover();
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    });
  }

  /**
   * Day list: directly below the "+N more" link, left-aligned.
   * Event: on the preferred side (`eventPopoverPosition`), then the opposite side, then the others;
   * wide anchors (multi-day bars) prefer a side placement next to their start.
   */
  private position(): void {
    const s = this.state();
    const host = this.el.nativeElement;
    if (!s) return;
    const gap = 6;
    const margin = 8;
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    const a = s.anchor;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top: number;
    let left: number;

    if (s.kind === 'day') {
      top = a.bottom + gap;
      left = a.left;
      if (top + h > vh - margin) top = a.top - h - gap;
    } else {
      type Side = 'top' | 'bottom' | 'left' | 'right';
      const place: Record<Side, { top: number; left: number; fits: boolean }> = {
        right: { top: a.top, left: a.right + gap, fits: a.right + gap + w <= vw - margin },
        left: { top: a.top, left: a.left - gap - w, fits: a.left - gap - w >= margin },
        bottom: { top: a.bottom + gap, left: a.left, fits: a.bottom + gap + h <= vh - margin },
        top: { top: a.top - gap - h, left: a.left, fits: a.top - gap - h >= margin },
      };
      const opposite: Record<Side, Side> = { right: 'left', left: 'right', top: 'bottom', bottom: 'top' };
      let pref = this.store.options().eventPopoverPosition as Side;
      // A bar wider than the card: place it beside the bar's start instead of past its far end.
      if (pref === 'right' && a.width > w) pref = 'left';
      const order: Side[] = [pref, opposite[pref], ...(['bottom', 'top', 'right', 'left'] as Side[])];
      const chosen = place[order.find((side) => place[side].fits) ?? 'bottom'];
      top = Math.min(chosen.top, vh - margin - h);
      left = chosen.left;
    }
    host.style.top = `${Math.round(Math.max(margin, top))}px`;
    host.style.left = `${Math.round(Math.min(Math.max(margin, left), vw - w - margin))}px`;
  }

  private sameDay(o: SchedulerOccurrence): boolean {
    return isSameDay(o.start, lastDay(o));
  }

  protected dayTitle(d: Date): string {
    return format(d, this.locale(), { month: 'long', day: 'numeric' });
  }

  /** Resource name, else the event's view context. */
  protected subtitle(o: SchedulerOccurrence): string {
    return this.store.resourceById(o.event.resourceId)?.title ?? this.store.label(this.store.view());
  }

  protected timeText(o: SchedulerOccurrence): string {
    if (o.event.allDay) return this.store.label('allDay');
    const loc = this.locale();
    if (this.sameDay(o)) return formatTimeRange(o.start, o.end, loc);
    const f: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
    return `${format(o.start, loc, f)} – ${format(o.end, loc, f)}`;
  }

  protected dateText(o: SchedulerOccurrence): string {
    const loc = this.locale();
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    const last = lastDay(o);
    if (isSameDay(o.start, last)) return format(o.start, loc, opts);
    const short: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    return `${format(o.start, loc, short)} – ${format(last, loc, short)}`;
  }

  protected durationText(o: SchedulerOccurrence): string {
    const minutes = o.event.allDay
      ? Math.max(1, diffDays(o.start, addDays(lastDay(o), 1))) * 1440
      : Math.round((o.end.getTime() - o.start.getTime()) / 60_000);
    return this.store.label('duration', minutes);
  }

  protected pick(o: SchedulerOccurrence, e: Event): void {
    this.store.pickFromPopover(o, e);
  }
}
