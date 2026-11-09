/** Built-in UI text. Override any subset through the `text` input. */
export interface SchedulerText {
  today: string;
  prev: string;
  next: string;
  day: string;
  week: string;
  month: string;
  year: string;
  agenda: string;
  timelineDay: string;
  timelineWeek: string;
  timelineMonth: string;
  timelineYear: string;
  resourceTimelineDay: string;
  resourceTimelineWeek: string;
  resourceTimelineMonth: string;
  allDay: string;
  noEvents: string;
  noViews: string;
  resources: string;
  unassigned: string;
  views: string;
  view: string;
  repeats: string;
  time: string;
  date: string;
  durationLabel: string;
  close: string;
  weekShort: string;
  /** "+3 more" */
  more: (count: number) => string;
  /** "5 events" */
  eventCount: (count: number) => string;
  /** Duration from minutes: "3 days", "1 h 30 min". */
  duration: (minutes: number) => string;
  [key: string]: string | ((count: number) => string);
}

/** @deprecated Use `SchedulerText`. */
export type SchedulerLabels = SchedulerText;

export const DEFAULT_TEXT: SchedulerText = {
  today: 'Today',
  prev: 'Previous',
  next: 'Next',
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  agenda: 'Agenda',
  timelineDay: 'Timeline day',
  timelineWeek: 'Timeline week',
  timelineMonth: 'Timeline month',
  timelineYear: 'Timeline year',
  resourceTimelineDay: 'Resource day',
  resourceTimelineWeek: 'Resource week',
  resourceTimelineMonth: 'Resource month',
  allDay: 'All day',
  noEvents: 'No events in this period',
  noViews: 'No views registered. Add provideSchedulerViews() to your providers.',
  resources: 'Resources',
  unassigned: 'Unassigned',
  views: 'Views',
  view: 'View',
  repeats: 'Repeats',
  time: 'Time',
  date: 'Date',
  durationLabel: 'Duration',
  close: 'Close',
  weekShort: 'W',
  more: (n) => `+${n} more`,
  eventCount: (n) => (n === 1 ? '1 event' : `${n} events`),
  duration: (minutes) => {
    if (minutes > 0 && minutes % 1440 === 0) {
      const d = minutes / 1440;
      return d === 1 ? '1 day' : `${d} days`;
    }
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return [h ? `${h} h` : '', m || !h ? `${m} min` : ''].filter(Boolean).join(' ');
  },
};

/** @deprecated Use `DEFAULT_TEXT`. */
export const DEFAULT_LABELS = DEFAULT_TEXT;
