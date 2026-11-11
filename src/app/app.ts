import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CALENDAR_IMPORTS,
  NgxCalendar,
  SchedulerDateSelectPayload,
  SchedulerEvent,
  SchedulerEventClickPayload,
  SchedulerHeaderToolbar,
  SchedulerResource,
  SchedulerTheme,
  SchedulerViewType,
  provideSchedulerViews,
} from 'ngx-calendar-kit';

const today = new Date();
const at = (dayOffset: number, h: number, m = 0) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, h, m);
const day = (dayOffset: number) => at(dayOffset, 0);

interface EventDraft {
  id: string | number | null;
  seriesId: string | number | null;
  occurrenceStart: Date | null;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  allDay: boolean;
  type: string;
  resourceId: string;
  color: string;
  description: string;
  recurrence: string;
  recurrenceOriginal: string;
}

const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const localTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const dateValue = (value: string | Date) => value instanceof Date ? new Date(value) : new Date(value.length === 10 ? `${value}T00:00:00` : value);
const fromLocal = (date: string, time: string) => new Date(`${date}T${time || '00:00'}:00`);

@Component({
  selector: 'app-root',
  imports: [CALENDAR_IMPORTS, FormsModule, DatePipe],
  providers: [provideSchedulerViews()],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly view = signal('month');
  protected readonly date = signal(new Date());
  protected readonly theme = signal<SchedulerTheme>('light');
  protected readonly locale = signal('en-US');
  protected readonly timeFormat = signal<'12h' | '24h'>('12h');
  protected readonly editable = signal(true);
  protected readonly selectable = signal(true);
  protected readonly businessHours = signal(true);
  protected readonly weekNumbers = signal(true);
  protected readonly showEmptyDays = signal(false);
  protected readonly eventPopover = signal(true);
  protected readonly customTemplates = signal(false);
  protected readonly status = signal('Select a date to add an event, or click an event to edit it.');
  protected readonly editor = signal<EventDraft | null>(null);
  protected readonly editorError = signal('');
  protected readonly eventTypes = ['Meeting', 'Focus', 'Deadline', 'Leave', 'Other'];
  private readonly scheduler = viewChild.required<NgxCalendar>('scheduler');
  private readonly eventTitle = viewChild<ElementRef<HTMLInputElement>>('eventTitle');
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
    { id: 20, title: 'Office hours', start: at(0, 16), duration: 30, rrule: { freq: 'WEEKLY', count: 6 }, exdate: [at(7, 16)], rdate: [at(3, 16)], resourceId: 'ops' },
  ]);
  protected toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  protected onEventClick(payload: SchedulerEventClickPayload): void {
    const id = 'originalId' in payload.event ? payload.event.originalId : payload.event.id;
    const event = this.scheduler().getEventById(id);
    if (event) {
      if ('isRecurring' in payload.event && payload.event.isRecurring) {
        this.openEditor(event, payload.event.start, payload.event.end, undefined, payload.event.start);
      } else this.openEditor(event);
    }
    // The library opens its preview after emitting eventClick; close that preview
    // once the demo's editor is visible so the two dialogs do not overlap.
    queueMicrotask(() => this.scheduler().clearSelection());
  }

  protected addExample(): void {
    const start = new Date(this.date());
    start.setHours(14, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    this.openEditor(null, start, end);
  }

  private openEditor(event: SchedulerEvent | null, start?: Date, end?: Date, resourceId?: string, occurrenceStart?: Date): void {
    const from = start ?? (event ? dateValue(event.start) : new Date());
    const allDay = event?.allDay ?? false;
    const until = end ?? (event?.end ? dateValue(event.end) : new Date(from.getTime() + (allDay ? 24 : 1) * 60 * 60_000));
    // The calendar stores all-day ends exclusively; display the last included day.
    const displayEnd = allDay ? new Date(until.getTime() - 1) : until;
    this.editorError.set('');
    const recurrence = occurrenceStart ? '' : typeof event?.rrule === 'string' ? event.rrule : event?.rrule
      ? `FREQ=${event.rrule.freq}${event.rrule.interval ? `;INTERVAL=${event.rrule.interval}` : ''}${event.rrule.count ? `;COUNT=${event.rrule.count}` : ''}${event.rrule.byDay?.length ? `;BYDAY=${event.rrule.byDay.join(',')}` : ''}`
      : '';
    this.editor.set({
      id: occurrenceStart ? null : event?.id ?? null,
      seriesId: occurrenceStart ? event!.id : null,
      occurrenceStart: occurrenceStart ?? null,
      title: event?.title ?? '',
      startDate: localDate(from),
      startTime: localTime(from),
      endDate: localDate(displayEnd),
      endTime: localTime(displayEnd),
      allDay,
      type: String(event?.categoryId ?? 'Meeting'),
      resourceId: String(event?.resourceId ?? resourceId ?? ''),
      color: event?.color && /^#[0-9a-f]{6}$/i.test(event.color) ? event.color : '#10b981',
      description: String(event?.metadata?.['description'] ?? ''),
      recurrence,
      recurrenceOriginal: recurrence,
    });
    setTimeout(() => this.eventTitle()?.nativeElement.focus());
  }

  protected closeEditor(): void {
    this.editor.set(null);
    this.editorError.set('');
  }

  protected saveEvent(): void {
    const draft = this.editor();
    if (!draft) return;
    const title = draft.title.trim();
    const start = fromLocal(draft.startDate, draft.allDay ? '00:00' : draft.startTime);
    const end = fromLocal(draft.endDate, draft.allDay ? '00:00' : draft.endTime);
    if (draft.allDay) end.setDate(end.getDate() + 1);
    if (!title || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      this.editorError.set('Enter a title and an end date/time after the start.');
      return;
    }
    const previous = draft.id === null && draft.seriesId === null ? null : this.scheduler().getEventById(draft.id ?? draft.seriesId!);
    const event: SchedulerEvent = {
      ...previous,
      id: draft.id ?? this.nextId++,
      title,
      start,
      end,
      allDay: draft.allDay,
      categoryId: draft.type,
      resourceId: draft.resourceId || undefined,
      color: draft.color,
      rrule: draft.seriesId === null
        ? draft.recurrence.trim() === draft.recurrenceOriginal ? previous?.rrule : draft.recurrence.trim() || undefined
        : undefined,
      recurrenceId: draft.occurrenceStart ?? previous?.recurrenceId,
      exdate: draft.seriesId === null ? previous?.exdate : undefined,
      rdate: draft.seriesId === null ? previous?.rdate : undefined,
      metadata: { ...previous?.metadata, description: draft.description.trim() },
    };
    // An explicit end replaces duration; a single resource replaces resourceIds.
    delete event.duration;
    delete event.resourceIds;
    if (draft.seriesId !== null && previous && draft.occurrenceStart) {
      this.excludeOccurrence(previous, draft.occurrenceStart);
      this.scheduler().addEvent(event);
    } else if (previous) this.scheduler().updateEvent(event);
    else this.scheduler().addEvent(event);
    this.status.set(`${previous ? 'Updated' : 'Added'} ${title}.`);
    this.closeEditor();
  }

  protected removeEvent(): void {
    const draft = this.editor();
    if (!draft) return;
    if (draft.seriesId !== null && draft.occurrenceStart) {
      const series = this.scheduler().getEventById(draft.seriesId);
      if (series) this.excludeOccurrence(series, draft.occurrenceStart);
    } else if (draft.id !== null) this.scheduler().removeEvent(draft.id);
    else return;
    this.status.set(`Removed ${draft.title}.`);
    this.closeEditor();
  }

  private excludeOccurrence(series: SchedulerEvent, occurrenceStart: Date): void {
    const excluded = Array.isArray(series.exdate) ? series.exdate : series.exdate?.split(',').map(dateValue) ?? [];
    this.scheduler().updateEvent({ ...series, exdate: [...excluded, occurrenceStart] });
  }

  /** Drag across empty slots (or press Enter on one) to create an event. */
  protected onDateSelect(s: SchedulerDateSelectPayload): void {
    this.scheduler().unselect();
    this.openEditor(null, s.start, s.end, s.resource ? String(s.resource.id) : undefined);
    if (s.allDay) this.editor.update((draft) => draft && ({ ...draft, allDay: true, endDate: localDate(new Date(s.end.getTime() - 1)) }));
  }

  /**
   * The scheduler applies drags, resizes and addEvent() to its own working copy and reports them.
   * Keep the app's source of truth in sync (this is where you would also call your API).
   */
  protected syncFromScheduler(): void {
    this.events.set(this.scheduler().getEvents());
  }
}
