import { NgModule } from '@angular/core';
import {
  SchAgendaDateHeaderTemplate,
  SchDayHeaderTemplate,
  SchEventTemplate,
  SchScheduler,
  SchSchedulerBody,
  SchSchedulerToolbar,
  provideSchedulerViews,
} from 'ng-scheduler-kit';

const PARTS = [SchScheduler, SchSchedulerToolbar, SchSchedulerBody, SchEventTemplate, SchDayHeaderTemplate, SchAgendaDateHeaderTemplate];

/** NgModule bundle for non-standalone apps. Registers all built-in views. */
@NgModule({
  imports: PARTS,
  exports: PARTS,
  providers: [provideSchedulerViews()],
})
export class SchedulerKitModule {}
