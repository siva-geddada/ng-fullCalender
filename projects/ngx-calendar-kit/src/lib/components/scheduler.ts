import {
  ChangeDetectionStrategy,
  Component,
  OutputEmitterRef,
  ViewEncapsulation,
  computed,
  contentChild,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
} from '@angular/core';
import { parseTime, startOfDay, withHourCycle } from '../core/date-utils';
import { toDate } from '../core/normalize';
import {
  AutoHeightOptions,
  BusinessHours,
  BusinessHoursConfig,
  DateRange,
  EventAllowCallback,
  SchedulerEvent,
  SchedulerHeaderToolbar,
  SchedulerHeight,
  SchedulerOptions,
  SchedulerResource,
  SchedulerTheme,
  SchedulerViewType,
  SelectAllowCallback,
  TimeFormatOptions,
  WeekDay,
} from '../core/models';
import { DEFAULT_TEXT, SchedulerText } from '../state/labels';
import { NGX_CALENDAR_CONTEXT, SchedulerOutputs, SchedulerStore } from '../state/scheduler-store';
import { NgxCalendarBody } from './body';
import { NgxCalendarPopover } from './popover';
import { NgxCalendarAgendaDateHeaderTemplate, NgxCalendarDayHeaderTemplate, NgxCalendarEventTemplate } from './templates';
import { NgxCalendarToolbar } from './toolbar';

const VALID_SLOTS = [5, 10, 15, 20, 30, 60];
const DEFAULT_TOOLBAR: SchedulerHeaderToolbar = { left: 'prev,next today', center: 'title', right: 'month,week,day' };
const DEFAULT_BUSINESS: Required<BusinessHoursConfig> = { daysOfWeek: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' };

function resolveBusinessHours(b: BusinessHours): Required<BusinessHoursConfig>[] {
  if (!b) return [];
  if (b === true) return [DEFAULT_BUSINESS];
  return (Array.isArray(b) ? b : [b]).map((c) => ({ ...DEFAULT_BUSINESS, ...c }));
}

/**
 * Scheduler root. Compose its parts, or leave it empty for the default layout:
 *
 * ```html
 * <ngx-calendar [events]="events" [(view)]="view" [(date)]="date" height="parent">
 *   <ngx-calendar-toolbar />
 *   <ngx-calendar-body />
 * </ngx-calendar>
 * ```
 *
 * Views are registered through providers, e.g. `provideSchedulerViews()`.
 */
@Component({
  selector: 'ngx-calendar',
  exportAs: 'ngxCalendar',
  imports: [NgxCalendarToolbar, NgxCalendarBody, NgxCalendarPopover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: '../../styles/scheduler.scss',
  providers: [SchedulerStore, { provide: NGX_CALENDAR_CONTEXT, useExisting: SchedulerStore }],
  host: {
    class: 'ngx-calendar',
    role: 'region',
    '[attr.aria-label]': 'ariaLabel()',
    '[class.ngx-calendar--dark]': "theme() === 'dark'",
    '[class.ngx-calendar--auto]': "theme() === 'auto'",
    '[class.ngx-calendar--readonly]': 'readonly() || !editable()',
    '[class.ngx-calendar--disabled]': 'disabled()',
    '[class.ngx-calendar--auto-height]': 'isAutoHeight()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[style.height]': 'heightStyle()',
    '[style.aspect-ratio]': 'aspectRatioStyle()',
    '[style.min-height]': 'minHeightStyle()',
    '[style.max-height]': 'maxHeightStyle()',
  },
  template: `
    <ng-content />
    @if (!toolbarPart() && !bodyPart()) {
      @if (headerToolbar() !== false) {
        <ngx-calendar-toolbar />
      }
      <ngx-calendar-body />
    }
    <ngx-calendar-popover />
  `,
})
export class NgxCalendar {
  private readonly store = inject(SchedulerStore);

  // ---------------- data ----------------
  readonly events = input<readonly SchedulerEvent[]>([]);
  readonly resources = input<readonly SchedulerResource[]>([]);
  readonly view = model<SchedulerViewType>('month');
  readonly date = model<Date>(new Date());
  readonly views = input<readonly SchedulerViewType[]>(['month', 'week', 'day', 'year', 'agenda']);

  // ---------------- layout ----------------
  readonly height = input<SchedulerHeight | undefined>(undefined);
  /** Width ÷ height used when no `height` is set. */
  readonly aspectRatio = input(1.2);
  readonly autoHeight = input<boolean | AutoHeightOptions>(false);
  readonly headerToolbar = input<false | SchedulerHeaderToolbar>(DEFAULT_TOOLBAR);
  readonly theme = input<SchedulerTheme>('light');
  readonly ariaLabel = input('Calendar');

  // ---------------- time & locale ----------------
  readonly locale = input<string | undefined>(undefined);
  readonly firstDayOfWeek = input<WeekDay>(0);
  readonly slotDuration = input(30);
  readonly slotMinTime = input('00:00');
  readonly slotMaxTime = input('24:00');
  readonly snapDuration = input<number | undefined>(undefined);
  /** Time the day/week grid scrolls to initially. */
  readonly scrollTime = input('08:00');
  readonly timeFormat = input<TimeFormatOptions | undefined>(undefined);
  readonly daysOfWeek = input<number[] | undefined>(undefined);
  readonly numberOfDays = input<number | undefined>(undefined);
  readonly weekNumbers = input(false);
  readonly weekNumbering = input<'auto' | 'iso' | 'us'>('iso');
  readonly businessHours = input<BusinessHours>(false);
  readonly showBusinessHours = input(true);
  readonly nowIndicator = input(true);
  readonly nowIndicatorInterval = input(60_000);
  readonly minDate = input<Date | string | null | undefined>(undefined);
  readonly maxDate = input<Date | string | null | undefined>(undefined);
  readonly navLinks = input(false);

  // ---------------- interaction ----------------
  readonly editable = input(false);
  readonly eventStartEditable = input(true);
  readonly eventDurationEditable = input(true);
  readonly selectable = input(true);
  readonly readonly = input(false);
  readonly disabled = input(false);
  readonly dragMinDistance = input(5);
  readonly eventAllow = input<EventAllowCallback | undefined>(undefined);
  readonly selectAllow = input<SelectAllowCallback | undefined>(undefined);

  // ---------------- month / agenda ----------------
  readonly maxEventsVisible = input(5);
  readonly showMorePopover = input(true);
  readonly agendaDays = input(30);
  readonly showEmptyDays = input(false);
  readonly noEventsMessage = input<string | undefined>(undefined);

  // ---------------- popovers ----------------
  readonly eventPopover = input(false);
  readonly eventPopoverDelay = input(300);
  readonly eventPopoverHideDelay = input(100);
  readonly eventPopoverPosition = input<'top' | 'bottom' | 'left' | 'right'>('right');

  // ---------------- timeline ----------------
  readonly timelineSlotDuration = input(60);
  readonly timelineSnapDuration = input<number | undefined>(undefined);
  readonly timelineSlotWidth = input(112);
  readonly timelineMinTime = input<string | undefined>(undefined);
  readonly timelineMaxTime = input<string | undefined>(undefined);
  readonly resourceAreaWidth = input<string | number>(200);
  readonly resourceRowHeight = input(48);
  readonly resourceAreaHeaderContent = input<string | undefined>(undefined);

  readonly text = input<Partial<SchedulerText> | undefined>(undefined);

  // ---------------- outputs ----------------
  readonly dateClick = output<SchedulerOutputs['dateClick']>();
  readonly dateSelect = output<SchedulerOutputs['dateSelect']>();
  readonly dateUnselect = output<SchedulerOutputs['dateUnselect']>();
  readonly eventClick = output<SchedulerOutputs['eventClick']>();
  readonly eventDblclick = output<SchedulerOutputs['eventDblclick']>();
  readonly eventMouseenter = output<SchedulerOutputs['eventMouseenter']>();
  readonly eventMouseleave = output<SchedulerOutputs['eventMouseleave']>();
  readonly eventDragStart = output<SchedulerOutputs['eventDragStart']>();
  readonly eventDrag = output<SchedulerOutputs['eventDrag']>();
  readonly eventDragStop = output<SchedulerOutputs['eventDragStop']>();
  readonly eventDrop = output<SchedulerOutputs['eventDrop']>();
  readonly eventResizeStart = output<SchedulerOutputs['eventResizeStart']>();
  readonly eventResize = output<SchedulerOutputs['eventResize']>();
  readonly eventResizeStop = output<SchedulerOutputs['eventResizeStop']>();
  readonly eventResourceChange = output<SchedulerOutputs['eventResourceChange']>();
  readonly eventChange = output<SchedulerOutputs['eventChange']>();
  readonly eventAdd = output<SchedulerOutputs['eventAdd']>();
  readonly eventRemove = output<SchedulerOutputs['eventRemove']>();
  readonly moreClick = output<SchedulerOutputs['moreClick']>();
  readonly datesChange = output<SchedulerOutputs['datesChange']>();
  readonly viewStateChange = output<SchedulerOutputs['viewStateChange']>();

  // ---------------- content parts ----------------
  protected readonly toolbarPart = contentChild(NgxCalendarToolbar, { descendants: true });
  protected readonly bodyPart = contentChild(NgxCalendarBody, { descendants: true });
  private readonly eventTpl = contentChild(NgxCalendarEventTemplate, { descendants: true });
  private readonly dayHeaderTpl = contentChild(NgxCalendarDayHeaderTemplate, { descendants: true });
  private readonly agendaHeaderTpl = contentChild(NgxCalendarAgendaDateHeaderTemplate, { descendants: true });

  // ---------------- derived ----------------
  private readonly autoHeightConfig = computed<AutoHeightOptions | null>(() => {
    const a = this.autoHeight();
    if (a === true) return { enabled: true };
    if (a && typeof a === 'object' && a.enabled !== false) return a;
    return null;
  });

  protected readonly isAutoHeight = computed(() => this.height() === 'auto' || !!this.autoHeightConfig());

  protected readonly heightStyle = computed<string | null>(() => {
    if (this.isAutoHeight()) return 'auto';
    const h = this.height();
    if (h === undefined || h === null || h === '') return null;
    if (typeof h === 'number') return `${h}px`;
    if (h === 'parent') return '100%';
    return h;
  });

  protected readonly aspectRatioStyle = computed(() =>
    this.heightStyle() === null && this.aspectRatio() > 0 ? String(this.aspectRatio()) : null,
  );
  protected readonly minHeightStyle = computed(() => {
    const m = this.autoHeightConfig()?.minHeight;
    return m ? `${m}px` : null;
  });
  protected readonly maxHeightStyle = computed(() => {
    const m = this.autoHeightConfig()?.maxHeight;
    return m ? `${m}px` : null;
  });

  private readonly options = computed<SchedulerOptions>(() => {
    const slotMinTime = parseTime(this.slotMinTime(), 0);
    const slotMaxTime = Math.max(slotMinTime + 60, parseTime(this.slotMaxTime(), 1440));
    const slotDuration = VALID_SLOTS.includes(this.slotDuration()) ? this.slotDuration() : 30;
    const tlMin = parseTime(this.timelineMinTime(), slotMinTime);
    const tlMax = Math.max(tlMin + 60, parseTime(this.timelineMaxTime(), slotMaxTime));
    const tlSlot = Math.max(5, this.timelineSlotDuration() || 60);
    const raw = this.resourceAreaWidth();
    return {
      locale: withHourCycle(this.locale(), this.timeFormat()?.format ?? 'auto'),
      firstDayOfWeek: this.firstDayOfWeek(),
      slotMinTime,
      slotMaxTime,
      slotDuration,
      snapDuration: Math.max(1, this.snapDuration() ?? slotDuration),
      scrollTime: parseTime(this.scrollTime(), 480),
      timeFormat: this.timeFormat()?.format ?? 'auto',
      editable: this.editable(),
      eventStartEditable: this.eventStartEditable(),
      eventDurationEditable: this.eventDurationEditable(),
      selectable: this.selectable(),
      readonly: this.readonly(),
      disabled: this.disabled(),
      maxEventsVisible: Math.max(1, Math.round(this.autoHeightConfig()?.maxEventsVisible ?? this.maxEventsVisible())),
      agendaDays: Math.min(366, Math.max(1, Math.round(this.agendaDays()))),
      showEmptyDays: this.showEmptyDays(),
      noEventsMessage: this.noEventsMessage(),
      showMorePopover: this.showMorePopover(),
      eventPopover: this.eventPopover(),
      eventPopoverDelay: Math.max(0, this.eventPopoverDelay()),
      eventPopoverHideDelay: Math.max(0, this.eventPopoverHideDelay()),
      eventPopoverPosition: this.eventPopoverPosition(),
      nowIndicator: this.nowIndicator(),
      nowIndicatorInterval: Math.max(1000, this.nowIndicatorInterval()),
      businessHours: resolveBusinessHours(this.businessHours()),
      showBusinessHours: this.showBusinessHours(),
      daysOfWeek: this.daysOfWeek()?.length ? this.daysOfWeek() : undefined,
      numberOfDays: this.numberOfDays() && this.numberOfDays()! > 0 ? Math.round(this.numberOfDays()!) : undefined,
      weekNumbers: this.weekNumbers(),
      weekNumbering: this.weekNumbering(),
      navLinks: this.navLinks(),
      minDate: toDate(this.minDate() ?? null),
      maxDate: toDate(this.maxDate() ?? null),
      dragMinDistance: Math.max(0, this.dragMinDistance()),
      timelineSlotDuration: tlSlot,
      timelineSnapDuration: Math.max(1, this.timelineSnapDuration() ?? tlSlot),
      timelineSlotWidth: Math.max(24, this.timelineSlotWidth()),
      timelineMinTime: tlMin,
      timelineMaxTime: tlMax,
      resourceAreaWidth: typeof raw === 'number' ? raw : parseFloat(raw) || 200,
      resourceRowHeight: Math.max(24, this.resourceRowHeight()),
      resourceAreaHeaderContent: this.resourceAreaHeaderContent() ?? '',
      autoHeight: this.isAutoHeight(),
    };
  });

  private readonly mergedText = computed<SchedulerText>(() => ({ ...DEFAULT_TEXT, ...this.text() }) as SchedulerText);

  constructor() {
    const outputs = this as unknown as Record<keyof SchedulerOutputs, OutputEmitterRef<unknown>>;
    this.store.connect({
      view: this.view,
      date: this.date,
      events: this.events,
      resources: this.resources,
      views: this.views,
      options: this.options,
      text: this.mergedText,
      headerToolbar: this.headerToolbar,
      eventAllow: this.eventAllow,
      selectAllow: this.selectAllow,
      eventTemplate: computed(() => this.eventTpl()?.template),
      dayHeaderTemplate: computed(() => this.dayHeaderTpl()?.template),
      agendaDateHeaderTemplate: computed(() => this.agendaHeaderTpl()?.template),
      emit: (name, payload) => outputs[name].emit(payload),
    });

    // datesChange / viewStateChange whenever the visible range or view changes.
    let last = '';
    effect(() => {
      const range = this.store.range();
      const view = this.store.view();
      const key = `${view}|${range.start.getTime()}|${range.end.getTime()}`;
      if (key === last) return;
      last = key;
      untracked(() => {
        this.datesChange.emit({ start: range.start, end: range.end });
        this.viewStateChange.emit({ dateRange: { start: range.start, end: range.end }, view });
      });
    });
  }

  // ---------------- methods ----------------
  addEvent(event: SchedulerEvent): void {
    this.store.addEvent(event);
  }
  updateEvent(event: SchedulerEvent): void {
    this.store.updateEvent(event);
  }
  removeEvent(id: string | number): void {
    this.store.removeEvent(id);
  }
  getEvents(): SchedulerEvent[] {
    return this.store.getEvents();
  }
  getEventById(id: string | number): SchedulerEvent | undefined {
    return this.store.getEventById(id);
  }
  getResources(): SchedulerResource[] {
    return [...this.resources()];
  }
  getResourceById(id: string | number): SchedulerResource | undefined {
    return this.store.resourceById(id);
  }
  changeView(view: SchedulerViewType): void {
    this.store.setView(view);
  }
  getView(): SchedulerViewType {
    return this.store.view();
  }
  getDate(): Date {
    return this.store.date();
  }
  getDateRange(): DateRange {
    const r = this.store.range();
    return { start: r.start, end: r.end };
  }
  gotoDate(date: string | Date): void {
    const d = toDate(date);
    if (d) this.store.setDate(d);
  }
  next(): void {
    this.store.next();
  }
  prev(): void {
    this.store.prev();
  }
  today(): void {
    this.store.today();
  }
  /** Selects a range programmatically (emits `dateSelect`). All-day when both ends are midnight. */
  select(start: Date, end: Date): void {
    const allDay = start.getTime() === startOfDay(start).getTime() && end.getTime() === startOfDay(end).getTime();
    this.store.selectRange(start, end, allDay, null);
  }
  unselect(): void {
    this.store.unselect();
  }
  clearSelection(): void {
    this.store.unselect();
    this.store.closePopover();
  }
}
