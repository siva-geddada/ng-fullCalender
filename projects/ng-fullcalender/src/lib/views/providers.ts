import { Provider } from '@angular/core';
import { addDays, addMonths, addYears, format, startOfDay, startOfMonth, startOfWeek, startOfYear } from '../core/date-utils';
import { DateRange, SchedulerOptions } from '../core/models';
import { SchedulerViewDefinition, provideSchedulerView } from '../state/view-registry';
import { SchAgendaView } from './agenda-view';
import { SchMonthView } from './month-view';
import { SchTimeGridView } from './time-grid-view';
import { SchTimelineView } from './timeline-view';
import { SchYearView } from './year-view';

function formatRange(r: DateRange, locale: string | undefined): string {
  const last = addDays(r.end, -1);
  if (+startOfDay(last) === +r.start) return format(r.start, locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).formatRange(r.start, last);
}

const dayTitle = (_r: DateRange, d: Date, o: SchedulerOptions) =>
  format(d, o.locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const monthTitle = (_r: DateRange, d: Date, o: SchedulerOptions) => format(d, o.locale, { month: 'long', year: 'numeric' });
const yearTitle = (_r: DateRange, d: Date) => String(d.getFullYear());

const dayRange = (d: Date): DateRange => ({ start: startOfDay(d), end: addDays(startOfDay(d), 1) });

/** Week-style window: `numberOfDays` days from the date, or the aligned week. */
const weekRange = (d: Date, o: SchedulerOptions): DateRange => {
  if (o.numberOfDays) return { start: startOfDay(d), end: addDays(startOfDay(d), o.numberOfDays) };
  const start = startOfWeek(d, o.firstDayOfWeek);
  return { start, end: addDays(start, 7) };
};
const weekStep = (d: Date, dir: 1 | -1, o: SchedulerOptions) => addDays(d, (o.numberOfDays ?? 7) * dir);
const monthRange = (d: Date): DateRange => ({ start: startOfMonth(d), end: addMonths(startOfMonth(d), 1) });
const yearRange = (d: Date): DateRange => ({ start: startOfYear(d), end: addYears(startOfYear(d), 1) });

export const DAY_VIEW: SchedulerViewDefinition = {
  type: 'day',
  labelKey: 'day',
  component: SchTimeGridView,
  range: dayRange,
  step: (d, dir) => addDays(d, dir),
  title: dayTitle,
};

export const WEEK_VIEW: SchedulerViewDefinition = {
  type: 'week',
  labelKey: 'week',
  component: SchTimeGridView,
  range: weekRange,
  step: weekStep,
  title: (r, _d, o) => formatRange(r, o.locale),
};

export const MONTH_VIEW: SchedulerViewDefinition = {
  type: 'month',
  labelKey: 'month',
  component: SchMonthView,
  // Always 6 weeks so the grid height is stable between months.
  range: (d, o) => {
    const start = startOfWeek(startOfMonth(d), o.firstDayOfWeek);
    return { start, end: addDays(start, 42) };
  },
  period: (d) => monthRange(d),
  step: (d, dir) => addMonths(d, dir),
  title: monthTitle,
};

export const YEAR_VIEW: SchedulerViewDefinition = {
  type: 'year',
  labelKey: 'year',
  component: SchYearView,
  range: yearRange,
  step: (d, dir) => addYears(d, dir),
  title: yearTitle,
};

export const AGENDA_VIEW: SchedulerViewDefinition = {
  type: 'agenda',
  labelKey: 'agenda',
  component: SchAgendaView,
  range: (d, o) => ({ start: startOfDay(d), end: addDays(startOfDay(d), o.agendaDays) }),
  step: (d, dir, o) => addDays(d, o.agendaDays * dir),
  title: (r, _d, o) => formatRange(r, o.locale),
};

const timeline = (
  type: string,
  scale: 'day' | 'week' | 'month' | 'year',
  base: Pick<SchedulerViewDefinition, 'range' | 'step' | 'title'>,
): SchedulerViewDefinition => ({ type, labelKey: type, component: SchTimelineView, data: { scale }, ...base });

export const TIMELINE_DAY_VIEW = timeline('timelineDay', 'day', { range: dayRange, step: (d, dir) => addDays(d, dir), title: dayTitle });
export const TIMELINE_WEEK_VIEW = timeline('timelineWeek', 'week', { range: weekRange, step: weekStep, title: (r, _d, o) => formatRange(r, o.locale) });
export const TIMELINE_MONTH_VIEW = timeline('timelineMonth', 'month', { range: monthRange, step: (d, dir) => addMonths(d, dir), title: monthTitle });
export const TIMELINE_YEAR_VIEW = timeline('timelineYear', 'year', { range: yearRange, step: (d, dir) => addYears(d, dir), title: yearTitle });

/** Resource timelines are timelines whose rows come from `resources`. */
export const RESOURCE_TIMELINE_DAY_VIEW = { ...TIMELINE_DAY_VIEW, type: 'resourceTimelineDay', labelKey: 'resourceTimelineDay' };
export const RESOURCE_TIMELINE_WEEK_VIEW = { ...TIMELINE_WEEK_VIEW, type: 'resourceTimelineWeek', labelKey: 'resourceTimelineWeek' };
export const RESOURCE_TIMELINE_MONTH_VIEW = { ...TIMELINE_MONTH_VIEW, type: 'resourceTimelineMonth', labelKey: 'resourceTimelineMonth' };

export const provideSchedulerDayView = (): Provider => provideSchedulerView(DAY_VIEW);
export const provideSchedulerWeekView = (): Provider => provideSchedulerView(WEEK_VIEW);
export const provideSchedulerMonthView = (): Provider => provideSchedulerView(MONTH_VIEW);
export const provideSchedulerYearView = (): Provider => provideSchedulerView(YEAR_VIEW);
export const provideSchedulerAgendaView = (): Provider => provideSchedulerView(AGENDA_VIEW);

/** timelineDay / Week / Month / Year plus the resourceTimeline* aliases. */
export function provideSchedulerTimelineViews(): Provider[] {
  return [
    TIMELINE_DAY_VIEW,
    TIMELINE_WEEK_VIEW,
    TIMELINE_MONTH_VIEW,
    TIMELINE_YEAR_VIEW,
    RESOURCE_TIMELINE_DAY_VIEW,
    RESOURCE_TIMELINE_WEEK_VIEW,
    RESOURCE_TIMELINE_MONTH_VIEW,
  ].map(provideSchedulerView);
}

/** @deprecated Use `provideSchedulerTimelineViews()`. Registers only `timelineDay`. */
export const provideSchedulerTimelineView = (): Provider => provideSchedulerView(TIMELINE_DAY_VIEW);

/** Registers every built-in view. */
export function provideSchedulerViews(): Provider[] {
  return [
    provideSchedulerMonthView(),
    provideSchedulerWeekView(),
    provideSchedulerDayView(),
    provideSchedulerYearView(),
    provideSchedulerAgendaView(),
    ...provideSchedulerTimelineViews(),
  ];
}
