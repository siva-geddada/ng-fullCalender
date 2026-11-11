import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { SchedulerStore } from '../state/scheduler-store';

/** Renders the active registered view. Place inside `<ngx-calendar>`. */
@Component({
  selector: 'ngx-calendar-body',
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ngx-calendar-body', '[attr.data-ngx-calendar-view]': 'store.view()' },
  template: `
    @if (store.activeView(); as v) {
      <ng-container *ngComponentOutlet="v.component" />
    } @else {
      <p class="ngx-calendar-body__empty">{{ store.label('noViews') }}</p>
    }
  `,
})
export class NgxCalendarBody {
  protected readonly store = inject(SchedulerStore);
}
