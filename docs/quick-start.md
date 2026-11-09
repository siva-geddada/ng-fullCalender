# Quick start

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideSchedulerViews } from 'ng-scheduler-kit/views/all';

export const appConfig: ApplicationConfig = {
  providers: [provideSchedulerViews()], // month, week, day, year, agenda, timeline*
};
```

```ts
// calendar.component.ts
import { Component, signal } from '@angular/core';
import { SCHEDULER_IMPORTS, SchedulerEvent } from 'ng-scheduler-kit';

@Component({
  selector: 'app-calendar',
  imports: [SCHEDULER_IMPORTS],
  template: `
    <sch-scheduler
      height="parent"
      [events]="events()"
      [(view)]="view"
      [(date)]="date"
      [editable]="true"
      [eventPopover]="true"
    />
  `,
  styles: `:host { display: block; height: 100vh; }`,
})
export class CalendarComponent {
  view = signal('month');
  date = signal(new Date());
  events = signal<SchedulerEvent[]>([
    { id: 1, title: 'Design review', start: '2026-11-09T11:00:00', end: '2026-11-09T12:30:00', color: '#ea580c' },
    { id: 2, title: 'Team offsite', start: '2026-11-12', end: '2026-11-14', allDay: true },
    { id: 3, title: 'Standup', start: '2026-11-02T09:30:00', duration: 15, rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  ]);
}
```

`SCHEDULER_IMPORTS` contains the root component, the toolbar, the body and the template directives. A `<sch-scheduler>` with no children renders the toolbar and body itself.
