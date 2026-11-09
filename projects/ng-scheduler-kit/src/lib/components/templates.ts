import { Directive, TemplateRef, inject } from '@angular/core';
import {
  SchedulerAgendaDateHeaderContext,
  SchedulerDayHeaderTemplateContext,
  SchedulerEventTemplateContext,
} from '../state/scheduler-store';

/**
 * Custom event rendering:
 * `<ng-template schEvent let-occ let-event="event" let-compact="compact">{{ event.title }}</ng-template>`
 */
@Directive({ selector: 'ng-template[schEvent]' })
export class SchEventTemplate {
  readonly template = inject<TemplateRef<SchedulerEventTemplateContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: SchEventTemplate, ctx: unknown): ctx is SchedulerEventTemplateContext {
    return true;
  }
}

/** Custom day column / cell header: `<ng-template schDayHeader let-date let-today="today">` */
@Directive({ selector: 'ng-template[schDayHeader]' })
export class SchDayHeaderTemplate {
  readonly template = inject<TemplateRef<SchedulerDayHeaderTemplateContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: SchDayHeaderTemplate, ctx: unknown): ctx is SchedulerDayHeaderTemplateContext {
    return true;
  }
}

/** Custom agenda date header: `<ng-template schAgendaDateHeader let-date let-events="events">` */
@Directive({ selector: 'ng-template[schAgendaDateHeader]' })
export class SchAgendaDateHeaderTemplate {
  readonly template = inject<TemplateRef<SchedulerAgendaDateHeaderContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: SchAgendaDateHeaderTemplate, ctx: unknown): ctx is SchedulerAgendaDateHeaderContext {
    return true;
  }
}
