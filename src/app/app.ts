import { Component, signal, viewChild } from '@angular/core';
import {
  SCHEDULER_IMPORTS,
  SchScheduler,
  SchedulerDateSelectPayload,
  SchedulerEvent,
  SchedulerHeaderToolbar,
  SchedulerResource,
  SchedulerTheme,
  SchedulerViewType,
  provideSchedulerViews,
} from 'ng-scheduler-kit';

const today = new Date();
const at = (dayOffset: number, h: number, m = 0) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, h, m);
const day = (dayOffset: number) => at(dayOffset, 0);

@Component({
  selector: 'app-root',
  imports: [SCHEDULER_IMPORTS],
  providers: [provideSchedulerViews()],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly view = signal('month');
  protected readonly date = signal(new Date());
  protected readonly theme = signal<SchedulerTheme>('light');
  private readonly scheduler = viewChild.required<SchScheduler>('scheduler');
  private nextId = 100;

  protected readonly views: SchedulerViewType[] = [
    'month', 'week', 'day', 'year', 'agenda', 'timelineDay', 'timelineWeek', 'timelineMonth', 'timelineYear',
  ];
  protected readonly toolbar: SchedulerHeaderToolbar = {
    left: 'prev,next today',
    center: 'title',
    right: this.views.join(','),
  };

  protected readonly resources: SchedulerResource[] = [
    { id: 'design', title: 'Design', color: '#d9480f' },
    { id: 'eng', title: 'Engineering', color: '#4b57d1' },
    { id: 'ops', title: 'Operations', color: '#2b8a3e' },
  ];

  protected readonly events = signal<SchedulerEvent[]>([
    { id: 1, title: 'Daily standup', start: at(-7, 9, 30), end: at(-7, 9, 45), rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', resourceId: 'eng' },
    { id: 2, title: 'Design review', start: at(0, 11), end: at(0, 12, 30), resourceId: 'design' },
    { id: 3, title: 'Architecture sync', start: at(0, 11, 30), end: at(0, 13), resourceId: 'eng' },
    { id: 4, title: 'Lunch & learn', start: at(1, 12), end: at(1, 13), color: '#db2777' },
    { id: 5, title: 'Release window', start: at(2, 15), end: at(2, 18), resourceId: 'ops' },
    { id: 6, title: 'Code freeze', start: day(-1), end: day(4), allDay: true, color: '#dc2626' },
    { id: 7, title: 'Brand kit handoff', start: day(2), end: day(6), allDay: true, color: '#ea580c' },
    { id: 8, title: 'Training week', start: day(9), end: day(14), allDay: true, color: '#0ea5e9' },
    { id: 9, title: 'Sprint planning', start: at(-2, 10), end: at(-2, 12), rrule: 'FREQ=WEEKLY;INTERVAL=2;COUNT=6', resourceId: 'eng' },
    { id: 10, title: 'Customer call', start: at(0, 15), end: at(0, 15, 45), resourceId: 'design' },
    { id: 11, title: 'Budget review', start: at(8, 10), end: at(8, 11), color: '#f59e0b' },
    { id: 12, title: 'Go/no-go meeting', start: at(9, 13), end: at(9, 14), color: '#9333ea' },
    { id: 13, title: 'Dry run', start: at(10, 9), end: at(10, 10), color: '#059669' },
    { id: 14, title: 'Newsletter draft', start: at(11, 11), end: at(11, 12), color: '#ec4899' },
    { id: 15, title: 'Retrospective', start: at(14, 9, 30), end: at(14, 10, 30), resourceId: 'eng' },
    { id: 16, title: 'Partner demo', start: at(15, 14), end: at(15, 15), color: '#7c3aed' },
    { id: 17, title: 'Launch checklist', start: at(17, 10), end: at(17, 11), color: '#059669' },
    { id: 18, title: 'Vendor sync', start: at(1, 16), end: at(1, 16, 30), resourceId: 'ops' },
    { id: 19, title: 'Interview loop', start: at(2, 13), end: at(2, 15), resourceId: 'design' },
  ]);

  protected toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  /** Drag across empty slots (or press Enter on one) to create an event. */
  protected onDateSelect(s: SchedulerDateSelectPayload): void {
    const title = window.prompt('New event title', 'New event');
    this.scheduler().unselect();
    if (!title) return;
    this.scheduler().addEvent({ id: this.nextId++, title, start: s.start, end: s.end, allDay: s.allDay, resourceId: s.resource?.id });
  }

  /**
   * The scheduler applies drags, resizes and addEvent() to its own working copy and reports them.
   * Keep the app's source of truth in sync (this is where you would also call your API).
   */
  protected syncFromScheduler(): void {
    this.events.set(this.scheduler().getEvents());
  }
}
