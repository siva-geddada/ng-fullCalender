import { NgModule } from '@angular/core';
import {
  NgxCalendarAgendaDateHeaderTemplate,
  NgxCalendarDayHeaderTemplate,
  NgxCalendarEventTemplate,
  NgxCalendar,
  NgxCalendarBody,
  NgxCalendarToolbar,
  provideSchedulerViews,
} from 'ngx-calendar-kit';

const PARTS = [NgxCalendar, NgxCalendarToolbar, NgxCalendarBody, NgxCalendarEventTemplate, NgxCalendarDayHeaderTemplate, NgxCalendarAgendaDateHeaderTemplate];

/** NgModule bundle for non-standalone apps. Registers all built-in views. */
@NgModule({
  imports: PARTS,
  exports: PARTS,
  providers: [provideSchedulerViews()],
})
export class SchedulerKitModule {}
