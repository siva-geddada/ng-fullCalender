import { InjectionToken, Provider, Type } from '@angular/core';
import { DateRange, SchedulerOptions, SchedulerViewType } from '../core/models';

/** Describes a view the scheduler body can render. Register with `provideSchedulerView()`. */
export interface SchedulerViewDefinition {
  /** View id used by the `view` / `views` inputs, e.g. `'week'`. */
  type: SchedulerViewType;
  /** Key into `SchedulerText` for the view switcher. */
  labelKey: string;
  /** Standalone component rendered inside `<sch-scheduler-body>`. */
  component: Type<unknown>;
  /** Visible range for an anchor date. `end` is exclusive. */
  range(date: Date, options: SchedulerOptions): DateRange;
  /**
   * The period a date belongs to, used for min/max navigation checks when it differs from the
   * rendered range (e.g. month: the month itself, not the 6-week grid). Defaults to `range`.
   */
  period?(date: Date, options: SchedulerOptions): DateRange;
  /** Next anchor date when navigating forward (1) or back (-1). */
  step(date: Date, direction: 1 | -1, options: SchedulerOptions): Date;
  /** Toolbar title. */
  title(range: DateRange, date: Date, options: SchedulerOptions): string;
  /** Free-form configuration read by the view component (e.g. timeline scale). */
  data?: Record<string, unknown>;
}

export const SCH_VIEWS = new InjectionToken<SchedulerViewDefinition[]>('SCH_VIEWS');

/** Registers a view definition (built-in or custom). */
export function provideSchedulerView(definition: SchedulerViewDefinition): Provider {
  return { provide: SCH_VIEWS, multi: true, useValue: definition };
}
