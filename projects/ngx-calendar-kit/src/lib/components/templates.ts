import { Directive, TemplateRef, inject } from '@angular/core';
import {
  SchedulerAgendaDateHeaderContext,
  SchedulerDayHeaderTemplateContext,
  SchedulerEventTemplateContext,
} from '../state/scheduler-store';

/**
 * Custom event rendering:
 * `<ng-template ngxCalendarEvent let-occ let-event="event" let-compact="compact">{{ event.title }}</ng-template>`
 */
@Directive({ selector: 'ng-template[ngxCalendarEvent]' })
export class NgxCalendarEventTemplate {
  readonly template = inject<TemplateRef<SchedulerEventTemplateContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: NgxCalendarEventTemplate, ctx: unknown): ctx is SchedulerEventTemplateContext {
    return true;
  }
}

/** Custom day column / cell header: `<ng-template ngxCalendarDayHeader let-date let-today="today">` */
@Directive({ selector: 'ng-template[ngxCalendarDayHeader]' })
export class NgxCalendarDayHeaderTemplate {
  readonly template = inject<TemplateRef<SchedulerDayHeaderTemplateContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: NgxCalendarDayHeaderTemplate, ctx: unknown): ctx is SchedulerDayHeaderTemplateContext {
    return true;
  }
}

/** Custom agenda date header: `<ng-template ngxCalendarAgendaDateHeader let-date let-events="events">` */
@Directive({ selector: 'ng-template[ngxCalendarAgendaDateHeader]' })
export class NgxCalendarAgendaDateHeaderTemplate {
  readonly template = inject<TemplateRef<SchedulerAgendaDateHeaderContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: NgxCalendarAgendaDateHeaderTemplate, ctx: unknown): ctx is SchedulerAgendaDateHeaderContext {
    return true;
  }
}
