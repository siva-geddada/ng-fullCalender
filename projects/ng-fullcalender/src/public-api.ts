/*
 * Public API Surface of ng-fullcalender
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
  SCH_SCHEDULER_CONTEXT,
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
export { SCH_VIEWS, provideSchedulerView, type SchedulerViewDefinition } from './lib/state/view-registry';

// Components
export { SchScheduler } from './lib/components/scheduler';
export { SchSchedulerToolbar } from './lib/components/toolbar';
export { SchSchedulerBody } from './lib/components/body';
export { SchEventContent } from './lib/components/event-content';
export { SchPopover, SchEventPopoverTrigger } from './lib/components/popover';
export { SchEventTemplate, SchDayHeaderTemplate, SchAgendaDateHeaderTemplate } from './lib/components/templates';

// Built-in views
export { SchTimeGridView } from './lib/views/time-grid-view';
export { SchMonthView } from './lib/views/month-view';
export { SchYearView } from './lib/views/year-view';
export { SchAgendaView } from './lib/views/agenda-view';
export { SchTimelineView, type TimelineScale } from './lib/views/timeline-view';
export * from './lib/views/providers';

/** Standalone imports for a full scheduler: root + toolbar + body + template directives. */
import { SchScheduler } from './lib/components/scheduler';
import { SchSchedulerToolbar } from './lib/components/toolbar';
import { SchSchedulerBody } from './lib/components/body';
import { SchAgendaDateHeaderTemplate, SchDayHeaderTemplate, SchEventTemplate } from './lib/components/templates';
export const SCHEDULER_IMPORTS = [
  SchScheduler,
  SchSchedulerToolbar,
  SchSchedulerBody,
  SchEventTemplate,
  SchDayHeaderTemplate,
  SchAgendaDateHeaderTemplate,
] as const;
