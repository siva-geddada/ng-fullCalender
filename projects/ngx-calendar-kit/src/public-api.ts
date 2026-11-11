/*
 * Public API Surface of ngx-calendar-kit
 */

// Models, payloads & helpers
export * from './lib/core/models';
export {
  addDays,
  addMinutes,
  addMonths,
  addYears,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  isSameDay,
  diffDays,
  isoWeek,
  weekNumber,
} from './lib/core/date-utils';
export { toDate, normalizeEvent, normalizeEvents, publicEvent, toExpandedEvent } from './lib/core/normalize';
export { expandOccurrences, parseRRule, type RecurrenceRule } from './lib/core/recurrence';
export { layoutDayColumn, layoutSpans, type TimedSegment, type SpanSegment } from './lib/core/layout';

// State, context & registry
export {
  NGX_CALENDAR_CONTEXT,
  injectSchedulerContext,
  type SchedulerContext,
  type SchedulerOutputs,
  type SchedulerSelection,
  type SchedulerEventTemplateContext,
  type SchedulerDayHeaderTemplateContext,
  type SchedulerAgendaDateHeaderContext,
  type PopoverState,
} from './lib/state/scheduler-store';
export { DEFAULT_TEXT, DEFAULT_LABELS, type SchedulerText, type SchedulerLabels } from './lib/state/labels';
export { NGX_CALENDAR_VIEWS, provideSchedulerView, type SchedulerViewDefinition } from './lib/state/view-registry';

// Components
export { NgxCalendar } from './lib/components/scheduler';
export { NgxCalendarToolbar } from './lib/components/toolbar';
export { NgxCalendarBody } from './lib/components/body';
export { NgxCalendarEventContent } from './lib/components/event-content';
export { NgxCalendarPopover, NgxCalendarEventPopoverTrigger } from './lib/components/popover';
export { NgxCalendarEventTemplate, NgxCalendarDayHeaderTemplate, NgxCalendarAgendaDateHeaderTemplate } from './lib/components/templates';

// Built-in views
export { NgxCalendarTimeGridView } from './lib/views/time-grid-view';
export { NgxCalendarMonthView } from './lib/views/month-view';
export { NgxCalendarYearView } from './lib/views/year-view';
export { NgxCalendarAgendaView } from './lib/views/agenda-view';
export { NgxCalendarTimelineView, type TimelineScale } from './lib/views/timeline-view';
export * from './lib/views/providers';

/** Standalone imports for the calendar: root + toolbar + body + template directives. */
import { NgxCalendar } from './lib/components/scheduler';
import { NgxCalendarToolbar } from './lib/components/toolbar';
import { NgxCalendarBody } from './lib/components/body';
import { NgxCalendarAgendaDateHeaderTemplate, NgxCalendarDayHeaderTemplate, NgxCalendarEventTemplate } from './lib/components/templates';
export const CALENDAR_IMPORTS = [
  NgxCalendar,
  NgxCalendarToolbar,
  NgxCalendarBody,
  NgxCalendarEventTemplate,
  NgxCalendarDayHeaderTemplate,
  NgxCalendarAgendaDateHeaderTemplate,
] as const;
