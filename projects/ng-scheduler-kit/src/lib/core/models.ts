// ===================================================================================
// Public data model. Names follow the documented Scheduler API so apps can migrate
// configuration and handlers without renaming fields.
// ===================================================================================

export type SchedulerViewType =
  | 'month'
  | 'week'
  | 'day'
  | 'year'
  | 'agenda'
  | 'timelineDay'
  | 'timelineWeek'
  | 'timelineMonth'
  | 'timelineYear'
  | 'resourceTimelineDay'
  | 'resourceTimelineWeek'
  | 'resourceTimelineMonth'
  | (string & {});

export type TimelineViewType = 'timelineDay' | 'timelineWeek' | 'timelineMonth' | 'timelineYear';

export type SchedulerTheme = 'light' | 'dark' | 'auto';

/** 0 = Sunday … 6 = Saturday */
export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type RRuleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RRuleWeekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

/** Object form of a recurrence rule (alternative to an RRULE string). */
export interface RRuleOptions {
  freq: RRuleFrequency;
  interval?: number;
  count?: number;
  until?: string | Date;
  byDay?: RRuleWeekday[];
}

export interface SchedulerEvent {
  id: string | number;
  title: string;
  /** Date, ISO string, or `YYYY-MM-DD` (local midnight). */
  start: string | Date;
  /** Exclusive. When omitted: `start + duration`, or one day (all-day) / one hour (timed). */
  end?: string | Date;
  allDay?: boolean;
  /** Minutes; used when `end` is missing. */
  duration?: number;
  color?: string;
  textColor?: string;
  borderColor?: string;
  className?: string;
  editable?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  resourceId?: string | number;
  resourceIds?: (string | number)[];
  /** RRULE string (`FREQ=WEEKLY;BYDAY=MO,WE`) or options object. */
  rrule?: string | RRuleOptions;
  /** Occurrence starts to skip: Date[] or a comma-separated string of dates. */
  exdate?: string | Date[];
  /** Extra occurrence starts: Date[] or a comma-separated string of dates. */
  rdate?: string | Date[];
  /** Original occurrence start this event replaces (exception of a series). */
  recurrenceId?: string | Date;
  categoryId?: string | number;
  categoryIds?: (string | number)[];
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface SchedulerResource {
  id: string | number;
  title: string;
  color?: string;
  [key: string]: unknown;
}

/** One concrete instance of an event inside the visible range (recurrences expanded). */
export interface ExpandedEvent {
  id: string;
  originalId: string | number;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  isRecurring: boolean;
  isException: boolean;
  originalStart?: Date;
  recurringEventId?: string | number;
  recurrenceId?: string | Date;
  color?: string;
  textColor?: string;
  className?: string;
  editable?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  resourceId?: string | number;
  resourceIds?: (string | number)[];
  categoryId?: string | number;
  categoryIds?: (string | number)[];
  timezone?: string;
  metadata?: Record<string, unknown>;
}

export interface DateRange {
  start: Date;
  /** Exclusive. */
  end: Date;
}

export interface BusinessHoursConfig {
  /** 0 = Sunday. Default Monday–Friday. */
  daysOfWeek?: number[];
  /** `HH:mm`, default `09:00`. */
  startTime?: string;
  /** `HH:mm`, default `17:00`. */
  endTime?: string;
}

export type BusinessHours = boolean | BusinessHoursConfig | BusinessHoursConfig[];

/** Space separates groups, comma joins items: `'prev,next today'`, `'title'`, `'month,week,day'`. */
export interface SchedulerHeaderToolbar {
  left?: string;
  center?: string;
  right?: string;
}

/** px number, `'auto'` (grow with content), `'parent'` (fill parent) or any CSS length. */
export type SchedulerHeight = number | 'auto' | 'parent' | (string & {});

export interface AutoHeightOptions {
  enabled?: boolean;
  minHeight?: number;
  maxHeight?: number;
  maxEventsVisible?: number;
}

export type TimeFormat = '12h' | '24h' | 'auto';

export interface TimeFormatOptions {
  format?: TimeFormat;
  showMinutes?: 'always' | 'non-zero';
}

export type SchedulerSelectionMode = 'none' | 'single' | 'multiple' | 'range';

export interface DragDelta {
  days: number;
  milliseconds: number;
}

export interface ResizeDelta {
  startDelta: number;
  endDelta: number;
}

export interface DropInfo {
  start: Date;
  end: Date;
  allDay: boolean;
  resourceId?: string | number;
  view: SchedulerViewType;
}

export interface SelectInfo {
  start: Date;
  end: Date;
  allDay: boolean;
  view: SchedulerViewType;
  resourceId?: string | number;
}

export type EventAllowCallback = (dropInfo: DropInfo, draggedEvent: SchedulerEvent) => boolean;
export type SelectAllowCallback = (selectInfo: SelectInfo) => boolean;

// ---------------- output payloads ----------------

export interface SchedulerDateClickPayload {
  date: Date;
  dateStr: string;
  allDay: boolean;
  jsEvent: Event;
  resource?: SchedulerResource;
  view: SchedulerViewType;
}

export interface SchedulerDateSelectPayload {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  allDay: boolean;
  jsEvent: Event | null;
  resource?: SchedulerResource;
  view: SchedulerViewType;
}

export interface SchedulerEventClickPayload {
  el: HTMLElement | null;
  /** The source event, or an `ExpandedEvent` for an occurrence of a recurring series. */
  event: SchedulerEvent | ExpandedEvent;
  jsEvent: Event;
  view: SchedulerViewType;
}

export type SchedulerEventMousePayload = SchedulerEventClickPayload;

export interface EventDragStartPayload {
  event: SchedulerEvent | ExpandedEvent;
  el: HTMLElement | null;
  jsEvent: PointerEvent;
  view: SchedulerViewType;
}

export interface EventDragPayload {
  event: SchedulerEvent | ExpandedEvent;
  delta: DragDelta;
  jsEvent: PointerEvent;
  view: SchedulerViewType;
}

export interface EventDragStopPayload {
  event: SchedulerEvent | ExpandedEvent;
  jsEvent: PointerEvent | null;
  view: SchedulerViewType;
}

export interface EventDropPayload {
  /** The event with its new start/end. */
  event: SchedulerEvent;
  oldEvent: SchedulerEvent | ExpandedEvent;
  newStart: Date;
  newEnd: Date;
  newResource?: SchedulerResource;
  delta: DragDelta;
  /** Restores the events as they were before the drop. */
  revert: () => void;
  view: SchedulerViewType;
}

export interface EventResizeStartPayload {
  event: SchedulerEvent | ExpandedEvent;
  el: HTMLElement | null;
  jsEvent: PointerEvent;
  view: SchedulerViewType;
}

export interface EventResizePayload {
  event: SchedulerEvent | ExpandedEvent;
  /** Milliseconds. */
  startDelta: number;
  /** Milliseconds. */
  endDelta: number;
  jsEvent: PointerEvent;
  view: SchedulerViewType;
}

export interface EventResizeStopPayload extends ResizeDelta {
  event: SchedulerEvent;
  oldEvent: SchedulerEvent | ExpandedEvent;
  revert: () => void;
  view: SchedulerViewType;
}

export interface EventResourceChangePayload {
  event: SchedulerEvent;
  oldResource?: SchedulerResource;
  newResource?: SchedulerResource;
  view: SchedulerViewType;
}

export interface SchedulerEventChangePayload {
  event: SchedulerEvent;
  oldEvent: SchedulerEvent | ExpandedEvent;
}

export interface MoreClickPayload {
  date: Date;
  events: (SchedulerEvent | ExpandedEvent)[];
  jsEvent: Event;
  resource?: SchedulerResource;
  sourceView: 'month' | 'timelineMonth' | 'timelineYear';
  view: SchedulerViewType;
}

export interface SchedulerViewStatePayload {
  dateRange: DateRange;
  view: SchedulerViewType;
}

// ===================================================================================
// Internal model (exported for custom views).
// ===================================================================================

/** A `SchedulerEvent` with parsed dates and resolved defaults. */
export interface NormalizedEvent {
  source: SchedulerEvent;
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color?: string;
  textColor?: string;
  borderColor?: string;
  className?: string;
  editable?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  /** First assigned resource (convenience). */
  resourceId?: string | number;
  resourceIds: (string | number)[];
  rrule?: string;
  exdate: Date[];
  rdate: Date[];
  recurrenceId?: Date;
  metadata?: Record<string, unknown>;
}

/** Rendering unit: one occurrence of a normalized event. */
export interface SchedulerOccurrence {
  /** Stable key: `${event.id}::${start.getTime()}` */
  key: string;
  event: NormalizedEvent;
  start: Date;
  end: Date;
  /** True when produced by an `rrule`/`rdate` expansion. */
  recurring: boolean;
}

/** Resolved configuration handed to views. */
export interface SchedulerOptions {
  locale: string | undefined;
  firstDayOfWeek: WeekDay;
  /** Minutes from midnight. */
  slotMinTime: number;
  slotMaxTime: number;
  slotDuration: number;
  snapDuration: number;
  scrollTime: number;
  timeFormat: TimeFormat;
  editable: boolean;
  eventStartEditable: boolean;
  eventDurationEditable: boolean;
  selectable: boolean;
  readonly: boolean;
  disabled: boolean;
  maxEventsVisible: number;
  agendaDays: number;
  showEmptyDays: boolean;
  noEventsMessage: string | undefined;
  showMorePopover: boolean;
  eventPopover: boolean;
  eventPopoverDelay: number;
  eventPopoverHideDelay: number;
  eventPopoverPosition: 'top' | 'bottom' | 'left' | 'right';
  nowIndicator: boolean;
  nowIndicatorInterval: number;
  businessHours: Required<BusinessHoursConfig>[];
  showBusinessHours: boolean;
  daysOfWeek: number[] | undefined;
  numberOfDays: number | undefined;
  weekNumbers: boolean;
  weekNumbering: 'auto' | 'iso' | 'us';
  navLinks: boolean;
  minDate: Date | null;
  maxDate: Date | null;
  dragMinDistance: number;
  timelineSlotDuration: number;
  timelineSnapDuration: number;
  timelineSlotWidth: number;
  timelineMinTime: number;
  timelineMaxTime: number;
  resourceAreaWidth: number;
  resourceRowHeight: number;
  resourceAreaHeaderContent: string;
  autoHeight: boolean;
}
