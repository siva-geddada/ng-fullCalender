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
import { NgxCalendar } from './scheduler';
import { NgxCalendarBody } from './body';
import { NgxCalendarToolbar } from './toolbar';
import { NgxCalendarAgendaDateHeaderTemplate, NgxCalendarEventTemplate } from './templates';
import { NgxCalendarTimelineView } from '../views/timeline-view';
import { NgxCalendarYearView } from '../views/year-view';

const at = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m);

@Component({
  imports: [NgxCalendar, NgxCalendarToolbar, NgxCalendarBody, NgxCalendarEventTemplate, NgxCalendarAgendaDateHeaderTemplate],
  providers: [provideSchedulerViews()],
  template: `
    <ngx-calendar
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
      <ngx-calendar-toolbar />
      <ngx-calendar-body />
      <ng-template ngxCalendarEvent let-occ let-event="event">
        <b class="custom">{{ event.title }}!</b>
      </ng-template>
      <ng-template ngxCalendarAgendaDateHeader let-date let-events="events">
        <span class="agenda-head">{{ date.getDate() }}:{{ events.length }}</span>
      </ng-template>
    </ngx-calendar>
  `,
})
class Host {
  sch = viewChild.required<NgxCalendar>('sch');
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
  const store = fixture.debugElement.query(By.directive(NgxCalendar)).injector.get(SchedulerStore);
  return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance, store };
}

describe('NgxCalendar', () => {
  it('defaults to the month view with a 6-week grid and the custom event template', async () => {
    const { el } = await render();
    expect(el.querySelector('.ngx-calendar-toolbar__title')?.textContent).toContain('November 2026');
    expect(el.querySelectorAll('.ngx-calendar-month__cell').length).toBe(42);
    expect(el.querySelector('.ngx-calendar-month .custom')?.textContent).toContain('!');
  });

  it('lists the headerToolbar views in the switcher and changes view (two-way)', async () => {
    const { el, fixture, host } = await render();
    const select = el.querySelector<HTMLSelectElement>('.ngx-calendar-select select')!;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(host.views);
    select.value = 'week';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.view()).toBe('week');
    expect(el.querySelectorAll('.ngx-calendar-tg__col').length).toBe(7);
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
    const chip = el.querySelector<HTMLElement>('.ngx-calendar-month .ngx-calendar-event')!;
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(host.clicked?.view).toBe('month');
    expect(host.clicked?.el).toBe(chip);
    expect(el.querySelector('.ngx-calendar-popover')!.getAttribute('role')).toBe('dialog');
  });

  it('emits dateClick and dateSelect (with ISO strings) for a week slot', async () => {
    const { el, fixture, host } = await render();
    host.view.set('week');
    await fixture.whenStable();
    el.querySelector<HTMLElement>('[data-ngx-calendar-slot="3-18"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
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

  it('drags a month event to the date under the pointer', async () => {
    const { el, fixture, host } = await render();
    const cells = Array.from(el.querySelectorAll<HTMLElement>('[data-ngx-calendar-date]'));
    const origin = cells.find((c) => c.getAttribute('data-ngx-calendar-date') === String(+at(11, 0)))!;
    const target = cells.find((c) => c.getAttribute('data-ngx-calendar-date') === String(+at(12, 0)))!;
    const rect = (left: number) => ({ left, right: left + 100, top: 0, bottom: 100, width: 100, height: 100, x: left, y: 0, toJSON: () => ({}) });
    origin.getBoundingClientRect = () => rect(0);
    target.getBoundingClientRect = () => rect(100);
    const chip = Array.from(el.querySelectorAll<HTMLElement>('.ngx-calendar-month .ngx-calendar-event'))
      .find((event) => event.getAttribute('aria-label')?.startsWith('Standup'))!;
    const pointer = (type: string, x: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: 50 }) as PointerEvent;
      Object.defineProperty(event, 'pointerId', { value: 1 });
      return event;
    };
    chip.dispatchEvent(pointer('pointerdown', 50));
    window.dispatchEvent(pointer('pointermove', 150));
    window.dispatchEvent(pointer('pointerup', 150));
    await fixture.whenStable();
    expect(host.dropped?.newStart).toEqual(at(12, 9));
  });

  it('reads the timeline target row from its prefixed data attribute', async () => {
    const { el, fixture, host } = await render();
    host.view.set('timelineDay');
    await fixture.whenStable();
    const track = el.querySelector<HTMLElement>('[data-ngx-calendar-resource]')!;
    track.getBoundingClientRect = () => ({ left: 0, right: 300, top: 0, bottom: 50, width: 300, height: 50, x: 0, y: 0, toJSON: () => ({}) });
    const view = fixture.debugElement.query(By.directive(NgxCalendarTimelineView)).componentInstance as NgxCalendarTimelineView;
    const point = (view as unknown as { at(x: number, y: number): { rowKey: string } }).at(10, 10);
    expect(point.rowKey).toBe(track.getAttribute('data-ngx-calendar-resource'));
  });

  it('reads the year selection target from its prefixed data attribute', async () => {
    const { el, fixture, host } = await render();
    host.view.set('year');
    await fixture.whenStable();
    const cell = el.querySelector<HTMLElement>(`[data-ngx-calendar-date="${+at(11, 0)}"]`)!;
    const original = document.elementFromPoint;
    document.elementFromPoint = () => cell;
    try {
      const view = fixture.debugElement.query(By.directive(NgxCalendarYearView)).componentInstance as NgxCalendarYearView;
      expect((view as unknown as { dayAt(x: number, y: number): Date }).dayAt(10, 10)).toEqual(at(11, 0));
    } finally {
      document.elementFromPoint = original;
    }
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
    const root = el.querySelector<HTMLElement>('ngx-calendar')!;
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
    const lanes = Number(getComputedStyle(el.querySelector<HTMLElement>('.ngx-calendar-month')!).getPropertyValue('--ngx-calendar-month-rows')) || store.options().maxEventsVisible;
    el.querySelector<HTMLButtonElement>('.ngx-calendar-month__more')!.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('.ngx-calendar-popover__item').length).toBe(7 - lanes);
  });

  it('renders the year view as twelve mini months with event dots', async () => {
    const { el, fixture, host } = await render();
    host.view.set('year');
    await fixture.whenStable();
    expect(el.querySelectorAll('.ngx-calendar-year__month').length).toBe(12);
    expect(el.querySelector(`[data-ngx-calendar-date="${new Date(2026, 10, 11).getTime()}"]`)!.classList).toContain('ngx-calendar-has-events');
  });

  it('renders timelineWeek with day and time header tiers, and timelineYear with 12 slots', async () => {
    const { el, fixture, host } = await render();
    host.view.set('timelineWeek');
    await fixture.whenStable();
    const tiers = el.querySelectorAll('.ngx-calendar-tl__tier');
    expect(tiers.length).toBe(2);
    expect(tiers[0].querySelectorAll('.ngx-calendar-tl__hcell').length).toBe(7);
    host.view.set('timelineYear');
    await fixture.whenStable();
    expect(el.querySelectorAll('.ngx-calendar-tl__tier--leaf .ngx-calendar-tl__hcell').length).toBe(12);
  });

  it('agenda uses the custom date header template', async () => {
    const { el, fixture, host } = await render();
    host.view.set('agenda');
    await fixture.whenStable();
    expect(el.querySelector('.agenda-head')?.textContent).toMatch(/^\d+:\d+$/);
  });
});

@Component({
  imports: [NgxCalendar],
  providers: [provideSchedulerMonthView()],
  template: `<ngx-calendar [events]="[]" view="week" />`,
})
class SingleViewHost {}

describe('view registration', () => {
  it('falls back to the first registered view and renders default parts without a switcher', async () => {
    const fixture = TestBed.createComponent(SingleViewHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ngx-calendar-toolbar')).not.toBeNull();
    expect(el.querySelector('.ngx-calendar-month')).not.toBeNull();
    expect(el.querySelector('.ngx-calendar-select')).toBeNull();
  });
});
