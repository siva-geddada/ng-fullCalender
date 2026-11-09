import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  EventDropPayload,
  SchedulerDateClickPayload,
  SchedulerDateSelectPayload,
  SchedulerEvent,
  SchedulerEventClickPayload,
  SchedulerHeaderToolbar,
} from '../core/models';
import { SchedulerStore } from '../state/scheduler-store';
import { provideSchedulerMonthView, provideSchedulerViews } from '../views/providers';
import { SchScheduler } from './scheduler';
import { SchSchedulerBody } from './body';
import { SchSchedulerToolbar } from './toolbar';
import { SchAgendaDateHeaderTemplate, SchEventTemplate } from './templates';

const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m);

@Component({
  imports: [SchScheduler, SchSchedulerToolbar, SchSchedulerBody, SchEventTemplate, SchAgendaDateHeaderTemplate],
  providers: [provideSchedulerViews()],
  template: `
    <sch-scheduler
      #sch
      [events]="events()"
      [(view)]="view"
      [(date)]="date"
      [editable]="true"
      [eventPopover]="popover()"
      [headerToolbar]="toolbar"
      [views]="views"
      [minDate]="minDate()"
      [height]="height()"
      [eventAllow]="allow()"
      (eventClick)="clicked = $event"
      (dateClick)="dateClicked = $event"
      (dateSelect)="selected = $event"
      (eventDrop)="dropped = $event"
    >
      <sch-scheduler-toolbar />
      <sch-scheduler-body />
      <ng-template schEvent let-occ let-event="event">
        <b class="custom">{{ event.title }}!</b>
      </ng-template>
      <ng-template schAgendaDateHeader let-date let-events="events">
        <span class="agenda-head">{{ date.getDate() }}:{{ events.length }}</span>
      </ng-template>
    </sch-scheduler>
  `,
})
class Host {
  sch = viewChild.required<SchScheduler>('sch');
  events = signal<SchedulerEvent[]>([
    { id: 1, title: 'Standup', start: at(11, 9), end: at(11, 9, 30) },
    { id: 2, title: 'Offsite', start: '2026-11-10', end: '2026-11-13', allDay: true },
    { id: 3, title: 'Weekly', start: at(2, 14), duration: 60, rrule: 'FREQ=WEEKLY;COUNT=10' },
  ]);
  view = signal('month');
  date = signal(new Date(2026, 10, 11));
  popover = signal(true);
  minDate = signal<Date | null>(null);
  height = signal<string | number | undefined>(undefined);
  allow = signal<((info: unknown, ev: unknown) => boolean) | undefined>(undefined);
  views = ['month', 'week', 'day', 'year', 'agenda', 'timelineDay', 'timelineWeek', 'timelineMonth', 'timelineYear'];
  toolbar: SchedulerHeaderToolbar = { left: 'prev,next today', center: 'title', right: this.views.join(',') };
  clicked?: SchedulerEventClickPayload;
  dateClicked?: SchedulerDateClickPayload;
  selected?: SchedulerDateSelectPayload;
  dropped?: EventDropPayload;
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const store = fixture.debugElement.query(By.directive(SchScheduler)).injector.get(SchedulerStore);
  return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance, store };
}

describe('SchScheduler', () => {
  it('defaults to the month view with a 6-week grid and the custom event template', async () => {
    const { el } = await render();
    expect(el.querySelector('.sch-toolbar__title')?.textContent).toContain('November 2026');
    expect(el.querySelectorAll('.sch-month__cell').length).toBe(42);
    expect(el.querySelector('.sch-month .custom')?.textContent).toContain('!');
  });

  it('lists the headerToolbar views in the switcher and changes view (two-way)', async () => {
    const { el, fixture, host } = await render();
    const select = el.querySelector<HTMLSelectElement>('.sch-select select')!;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(host.views);
    select.value = 'week';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.view()).toBe('week');
    expect(el.querySelectorAll('.sch-tg__col').length).toBe(7);
  });

  it('navigates with next/prev and blocks prev before minDate', async () => {
    const { el, fixture, host } = await render();
    el.querySelector<HTMLButtonElement>('[aria-label="Next"]')!.click();
    await fixture.whenStable();
    expect(host.date().getMonth()).toBe(11);
    host.minDate.set(new Date(2026, 11, 1));
    await fixture.whenStable();
    expect(el.querySelector<HTMLButtonElement>('[aria-label="Previous"]')!.disabled).toBe(true);
  });

  it('emits eventClick with { event, el, view } and pins the popover', async () => {
    const { el, fixture, host } = await render();
    const chip = el.querySelector<HTMLElement>('.sch-month .sch-event')!;
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(host.clicked?.view).toBe('month');
    expect(host.clicked?.el).toBe(chip);
    expect(el.querySelector('.sch-popover')!.getAttribute('role')).toBe('dialog');
  });

  it('emits dateClick and dateSelect (with ISO strings) for a week slot', async () => {
    const { el, fixture, host } = await render();
    host.view.set('week');
    await fixture.whenStable();
    el.querySelector<HTMLElement>('[data-sch-slot="3-18"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    expect(host.dateClicked?.date).toEqual(at(11, 9));
    expect(host.selected).toMatchObject({ allDay: false, view: 'week' });
    expect(host.selected!.startStr).toBe(at(11, 9).toISOString());
    expect(host.selected!.end).toEqual(at(11, 9, 30));
  });

  it('exposes methods: addEvent, updateEvent, removeEvent, gotoDate, changeView, getDateRange', async () => {
    const { fixture, host } = await render();
    const sch = host.sch();
    sch.addEvent({ id: 9, title: 'Added', start: at(20, 10) });
    expect(sch.getEventById(9)?.title).toBe('Added');
    sch.updateEvent({ id: 9, title: 'Renamed', start: at(20, 10) });
    expect(sch.getEventById(9)?.title).toBe('Renamed');
    sch.removeEvent(9);
    expect(sch.getEventById(9)).toBeUndefined();
    sch.gotoDate('2027-03-15');
    sch.changeView('week');
    await fixture.whenStable();
    expect(sch.getView()).toBe('week');
    expect(sch.getDateRange().start).toEqual(new Date(2027, 2, 14));
  });

  it('applies a drop to the working events, emits eventDrop, and revert() restores it', async () => {
    const { host, store } = await render();
    const occ = store.occurrences().find((o) => o.event.id === 1)!;
    const pe = new MouseEvent('pointermove') as PointerEvent;
    store.dragStart(occ, 'move', null, pe);
    store.dragMove(occ, 'move', at(12, 10), at(12, 10, 30), pe);
    store.dragEnd(occ, 'move', pe);
    expect(host.dropped?.newStart).toEqual(at(12, 10));
    expect(host.dropped?.delta.days).toBe(1);
    expect(host.sch().getEventById(1)!.start).toEqual(at(12, 10));
    host.dropped!.revert();
    expect(host.sch().getEventById(1)!.start).toEqual(at(11, 9));
  });

  it('rejects a drop when eventAllow returns false', async () => {
    const { host, store, fixture } = await render();
    host.allow.set(() => false);
    await fixture.whenStable();
    const occ = store.occurrences().find((o) => o.event.id === 1)!;
    const pe = new MouseEvent('pointermove') as PointerEvent;
    store.dragMove(occ, 'move', at(12, 10), at(12, 10, 30), pe);
    expect(store.drag()?.valid).toBe(false);
    store.dragEnd(occ, 'move', pe);
    expect(host.dropped).toBeUndefined();
  });

  it('turns a dragged recurring occurrence into an exception (exdate + standalone event)', async () => {
    const { host, store } = await render();
    const occ = store.occurrences().find((o) => o.event.id === 3 && o.start.getDate() === 9)!;
    const pe = new MouseEvent('pointermove') as PointerEvent;
    store.dragMove(occ, 'move', at(9, 16), at(9, 17), pe);
    store.dragEnd(occ, 'move', pe);
    const series = host.sch().getEventById(3)!;
    expect((series.exdate as Date[]).map((d) => d.getTime())).toContain(at(9, 14).getTime());
    expect(host.sch().getEvents().some((e) => e.recurrenceId instanceof Date && e.start instanceof Date && +e.start === +at(9, 16))).toBe(true);
  });

  it('sizes from height: number → px, "parent" → 100%, default → aspect-ratio', async () => {
    const { el, fixture, host } = await render();
    const root = el.querySelector<HTMLElement>('sch-scheduler')!;
    // aspect-ratio is applied when no height is set (jsdom drops the property; covered in the browser check).
    expect(root.style.height).toBe('');
    host.height.set('parent');
    await fixture.whenStable();
    expect(root.style.height).toBe('100%');
    host.height.set(600 as unknown as string);
    await fixture.whenStable();
    expect(root.style.height).toBe('600px');
  });

  it('"+N more" opens the hidden-events popover', async () => {
    const { el, fixture, host, store } = await render();
    host.events.set(Array.from({ length: 7 }, (_, i) => ({ id: i, title: `E${i}`, start: at(18, 8 + i), end: at(18, 9 + i) })));
    await fixture.whenStable();
    const lanes = Number(getComputedStyle(el.querySelector<HTMLElement>('.sch-month')!).getPropertyValue('--sch-month-rows')) || store.options().maxEventsVisible;
    el.querySelector<HTMLButtonElement>('.sch-month__more')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('.sch-popover__item').length).toBe(7 - lanes);
  });

  it('renders the year view as twelve mini months with event dots', async () => {
    const { el, fixture, host } = await render();
    host.view.set('year');
    await fixture.whenStable();
    expect(el.querySelectorAll('.sch-year__month').length).toBe(12);
    expect(el.querySelector(`[data-sch-date="${new Date(2026, 10, 11).getTime()}"]`)!.classList).toContain('sch-has-events');
  });

  it('renders timelineWeek with day and time header tiers, and timelineYear with 12 slots', async () => {
    const { el, fixture, host } = await render();
    host.view.set('timelineWeek');
    await fixture.whenStable();
    const tiers = el.querySelectorAll('.sch-tl__tier');
    expect(tiers.length).toBe(2);
    expect(tiers[0].querySelectorAll('.sch-tl__hcell').length).toBe(7);
    host.view.set('timelineYear');
    await fixture.whenStable();
    expect(el.querySelectorAll('.sch-tl__tier--leaf .sch-tl__hcell').length).toBe(12);
  });

  it('agenda uses the custom date header template', async () => {
    const { el, fixture, host } = await render();
    host.view.set('agenda');
    await fixture.whenStable();
    expect(el.querySelector('.agenda-head')?.textContent).toMatch(/^\d+:\d+$/);
  });
});

@Component({
  imports: [SchScheduler],
  providers: [provideSchedulerMonthView()],
  template: `<sch-scheduler [events]="[]" view="week" />`,
})
class SingleViewHost {}

describe('view registration', () => {
  it('falls back to the first registered view and renders default parts without a switcher', async () => {
    const fixture = TestBed.createComponent(SingleViewHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('sch-scheduler-toolbar')).not.toBeNull();
    expect(el.querySelector('.sch-month')).not.toBeNull();
    expect(el.querySelector('.sch-select')).toBeNull();
  });
});
