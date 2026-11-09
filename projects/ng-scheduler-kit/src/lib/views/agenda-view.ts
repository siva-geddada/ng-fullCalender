import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { eachDay, format, formatTimeRange } from '../core/date-utils';
import { isToday, occurrencesOnDay } from '../core/layout';
import { publicEvent } from '../core/normalize';
import { SchedulerOccurrence } from '../core/models';
import { SchEventContent } from '../components/event-content';
import { SchedulerStore } from '../state/scheduler-store';

/** Chronological list of days (with events, or all with `showEmptyDays`). */
@Component({
  selector: 'sch-agenda-view',
  imports: [SchEventContent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sch-agenda' },
  template: `
    @for (group of groups(); track group.day.getTime()) {
      <section
        class="sch-agenda__day"
        [class.sch-is-today]="today(group.day)"
        [class.sch-is-empty]="!group.items.length"
        [attr.aria-label]="longDate(group.day)"
      >
        <header class="sch-agenda__date">
          @if (store.agendaDateHeaderTemplate(); as tpl) {
            <ng-container *ngTemplateOutlet="tpl; context: { $implicit: group.day, events: group.events, today: today(group.day) }" />
          } @else {
            <span class="sch-agenda__daynum">{{ group.day.getDate() }}</span>
            <span class="sch-agenda__daymeta">
              <span class="sch-agenda__weekday">{{ weekday(group.day) }}</span>
              <span class="sch-agenda__month">{{ month(group.day) }}</span>
            </span>
          }
        </header>
        @if (group.items.length) {
          <ul class="sch-agenda__list" role="list">
            @for (occ of group.items; track occ.key) {
              <li>
                <button
                  type="button"
                  class="sch-agenda__item"
                  [class]="occ.event.className ?? ''"
                  [style.--sch-event-color]="store.colorOf(occ)"
                  (click)="store.activateEvent(occ, $event, $any($event.currentTarget))"
                  (dblclick)="store.eventDblclick(occ, $event, $any($event.currentTarget))"
                >
                  <span class="sch-agenda__dot" aria-hidden="true"></span>
                  <span class="sch-agenda__when">{{ when(occ) }}</span>
                  <span class="sch-agenda__what">
                    @if (store.eventTemplate()) {
                      <sch-event-content [occ]="occ" [compact]="true" />
                    } @else {
                      {{ occ.event.title }}
                    }
                  </span>
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="sch-agenda__none">{{ emptyText() }}</p>
        }
      </section>
    } @empty {
      <p class="sch-agenda__empty">{{ emptyText() }}</p>
    }
  `,
})
export class SchAgendaView {
  protected readonly store = inject(SchedulerStore);
  private readonly locale = computed(() => this.store.options().locale);

  protected readonly emptyText = computed(() => this.store.options().noEventsMessage ?? this.store.label('noEvents'));

  protected readonly groups = computed(() => {
    const occs = this.store.occurrences();
    const { start, end } = this.store.range();
    const showEmpty = this.store.options().showEmptyDays;
    return eachDay(start, end)
      .map((day) => {
        const items = occurrencesOnDay(occs, day);
        return { day, items, events: items.map(publicEvent) };
      })
      .filter((g) => showEmpty || g.items.length > 0);
  });

  protected today(d: Date): boolean {
    return isToday(d);
  }
  protected weekday(d: Date): string {
    return format(d, this.locale(), { weekday: 'long' });
  }
  protected month(d: Date): string {
    return format(d, this.locale(), { month: 'long', year: 'numeric' });
  }
  protected longDate(d: Date): string {
    return format(d, this.locale(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  protected when(o: SchedulerOccurrence): string {
    return o.event.allDay ? this.store.label('allDay') : formatTimeRange(o.start, o.end, this.locale());
  }
}
