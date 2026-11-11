import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { formatTime, formatTimeRange } from '../core/date-utils';
import { publicEvent } from '../core/normalize';
import { SchedulerOccurrence } from '../core/models';
import { SchedulerStore } from '../state/scheduler-store';

/** Default event body, or the user's `ngxCalendarEvent` template when provided. */
@Component({
  selector: 'ngx-calendar-event-content',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ngx-calendar-event-content' },
  template: `
    @if (store.eventTemplate(); as tpl) {
      <ng-container *ngTemplateOutlet="tpl; context: { $implicit: occ(), event: event(), view: store.view(), compact: compact() }" />
    } @else {
      <span class="ngx-calendar-event-content__title">{{ occ().event.title }}</span>
      @if (time()) {
        <span class="ngx-calendar-event-content__time">{{ time() }}</span>
      }
    }
  `,
})
export class NgxCalendarEventContent {
  protected readonly store = inject(SchedulerStore);
  readonly occ = input.required<SchedulerOccurrence>();
  readonly compact = input(false);
  /** Hide the time (e.g. all-day / multi-day bars). */
  readonly showTime = input(true);

  protected readonly event = computed(() => publicEvent(this.occ()));

  protected readonly time = computed(() => {
    const o = this.occ();
    if (!this.showTime() || o.event.allDay) return '';
    const locale = this.store.options().locale;
    return this.compact() ? formatTime(o.start, locale) : formatTimeRange(o.start, o.end, locale);
  });
}
