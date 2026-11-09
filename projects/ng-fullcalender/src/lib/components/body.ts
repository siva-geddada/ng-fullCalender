import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { SchedulerStore } from '../state/scheduler-store';

/** Renders the active registered view. Place inside `<sch-scheduler>`. */
@Component({
  selector: 'sch-scheduler-body',
  imports: [NgComponentOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sch-body', '[attr.data-sch-view]': 'store.view()' },
  template: `
    @if (store.activeView(); as v) {
      <ng-container *ngComponentOutlet="v.component" />
    } @else {
      <p class="sch-body__empty">{{ store.label('noViews') }}</p>
    }
  `,
})
export class SchSchedulerBody {
  protected readonly store = inject(SchedulerStore);
}
