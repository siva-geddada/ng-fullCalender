import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgxCalendar } from 'ngx-calendar-kit';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Calendar Kit');
    const calendar = compiled.querySelector<HTMLElement>('ngx-calendar')!;
    expect(calendar.classList.contains('ngx-calendar--auto-height')).toBe(true);
    expect(calendar.style.height).toBe('auto');
  });

  it('switches views and calendar options from the demo controls', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const view = root.querySelector<HTMLSelectElement>('.demo__controls select')!;
    view.value = 'agenda';
    view.dispatchEvent(new Event('change'));
    const checkboxes = root.querySelectorAll<HTMLInputElement>('.demo__controls input[type="checkbox"]');
    checkboxes[0].click();
    await fixture.whenStable();
    expect(view.value).toBe('agenda');
    expect(checkboxes[0].checked).toBe(false);
    expect(root.querySelector('ngx-calendar-agenda-view')).not.toBeNull();
  });

  it('places the controls left of the calendar and uses the vector mark', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.demo__settings-sidebar .demo__controls select')).not.toBeNull();
    expect(root.querySelector('.demo__main-pane ngx-calendar')).not.toBeNull();
    expect(root.querySelector('.demo__summary')).toBeNull();
    expect(root.querySelector<HTMLImageElement>('.demo__brand-mark')?.getAttribute('src')).toBe('calendar-kit-mark.svg');
  });

  it('adds an event with its dates, time, type and resource through the popup', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.demo__add')!.click();
    await fixture.whenStable();
    const set = (name: string, value: string) => {
      const field = root.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('title', 'Planning session');
    set('startDate', '2026-11-12');
    set('startTime', '10:15');
    set('endDate', '2026-11-12');
    set('endTime', '11:45');
    set('type', 'Meeting');
    set('resource', 'design');
    root.querySelector<HTMLFormElement>('.demo__form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    const calendar = fixture.debugElement.query(By.directive(NgxCalendar)).componentInstance as NgxCalendar;
    expect(calendar.getEvents().find((e) => e.title === 'Planning session')).toMatchObject({
      start: new Date(2026, 10, 12, 10, 15),
      end: new Date(2026, 10, 12, 11, 45),
      categoryId: 'Meeting',
      resourceId: 'design',
    });
    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });

  it('edits an existing event and validates its end time', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const calendar = fixture.debugElement.query(By.directive(NgxCalendar)).componentInstance as NgxCalendar;
    const chip = Array.from(root.querySelectorAll<HTMLElement>('.ngx-calendar-month .ngx-calendar-event'))
      .find((element) => element.getAttribute('aria-label')?.startsWith('Design review'))!;
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    const title = root.querySelector<HTMLInputElement>('[name="title"]')!;
    title.value = 'Updated review';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    const endDate = root.querySelector<HTMLInputElement>('[name="endDate"]')!;
    endDate.value = '2000-01-01';
    endDate.dispatchEvent(new Event('input', { bubbles: true }));
    const form = root.querySelector<HTMLFormElement>('.demo__form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('end date/time after the start');
    expect(calendar.getEventById(2)?.title).toBe('Design review');
    endDate.value = '2030-01-01';
    endDate.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(calendar.getEventById(2)?.title).toBe('Updated review');
    expect(calendar.getEventById(2)?.end).toEqual(new Date(2030, 0, 1, 12, 30));
  });

  it('edits one recurring occurrence without changing the entire series', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const calendar = fixture.debugElement.query(By.directive(NgxCalendar)).componentInstance as NgxCalendar;
    const chip = Array.from(root.querySelectorAll<HTMLElement>('.ngx-calendar-month .ngx-calendar-event'))
      .find((element) => element.getAttribute('aria-label')?.startsWith('Daily standup'))!;
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    expect(root.querySelector('#event-editor-title')?.textContent).toBe('Edit occurrence');
    const title = root.querySelector<HTMLInputElement>('[name="title"]')!;
    title.value = 'Special standup';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLFormElement>('.demo__form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(calendar.getEventById(1)?.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect((calendar.getEventById(1)?.exdate as Date[]).length).toBe(1);
    expect(calendar.getEvents().find((event) => event.title === 'Special standup')?.recurrenceId).toBeInstanceOf(Date);
  });
});
