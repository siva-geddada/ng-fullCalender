import { Injectable, InjectionToken, Signal, TemplateRef, WritableSignal, computed, inject, linkedSignal, signal } from '@angular/core';
import { addDays, diffDays, startOfDay, toPayloadStr } from '../core/date-utils';
import { expandOccurrences } from '../core/recurrence';
import { normalizeEvents, publicEvent } from '../core/normalize';
import {
  DateRange,
  EventAllowCallback,
  EventDragPayload,
  EventDragStartPayload,
  EventDragStopPayload,
  EventDropPayload,
  EventResizePayload,
  EventResizeStartPayload,
  EventResizeStopPayload,
  EventResourceChangePayload,
  ExpandedEvent,
  MoreClickPayload,
  SchedulerDateClickPayload,
  SchedulerDateSelectPayload,
  SchedulerEvent,
  SchedulerEventChangePayload,
  SchedulerEventClickPayload,
  SchedulerEventMousePayload,
  SchedulerHeaderToolbar,
  SchedulerOccurrence,
  SchedulerOptions,
  SchedulerResource,
  SchedulerViewStatePayload,
  SchedulerViewType,
  SelectAllowCallback,
} from '../core/models';
import { SchedulerText } from './labels';
import { SCH_VIEWS, SchedulerViewDefinition } from './view-registry';

/** Every output the root can emit, keyed by output name. */
export interface SchedulerOutputs {
  dateClick: SchedulerDateClickPayload;
  dateSelect: SchedulerDateSelectPayload;
  dateUnselect: { view: SchedulerViewType };
  eventClick: SchedulerEventClickPayload;
  eventDblclick: SchedulerEventClickPayload;
  eventMouseenter: SchedulerEventMousePayload;
  eventMouseleave: SchedulerEventMousePayload;
  eventDragStart: EventDragStartPayload;
  eventDrag: EventDragPayload;
  eventDragStop: EventDragStopPayload;
  eventDrop: EventDropPayload;
  eventResizeStart: EventResizeStartPayload;
  eventResize: EventResizePayload;
  eventResizeStop: EventResizeStopPayload;
  eventResourceChange: EventResourceChangePayload;
  eventChange: SchedulerEventChangePayload;
  eventAdd: SchedulerEvent;
  eventRemove: { event: SchedulerEvent };
  moreClick: MoreClickPayload;
  datesChange: DateRange;
  viewStateChange: SchedulerViewStatePayload;
}

/** What the root component hands to the store. */
export interface SchedulerHost {
  view: WritableSignal<string>;
  date: WritableSignal<Date>;
  events: Signal<readonly SchedulerEvent[]>;
  resources: Signal<readonly SchedulerResource[]>;
  views: Signal<readonly string[] | undefined>;
  options: Signal<SchedulerOptions>;
  text: Signal<SchedulerText>;
  headerToolbar: Signal<false | SchedulerHeaderToolbar>;
  eventAllow: Signal<EventAllowCallback | undefined>;
  selectAllow: Signal<SelectAllowCallback | undefined>;
  eventTemplate: Signal<TemplateRef<SchedulerEventTemplateContext> | undefined>;
  dayHeaderTemplate: Signal<TemplateRef<SchedulerDayHeaderTemplateContext> | undefined>;
  agendaDateHeaderTemplate: Signal<TemplateRef<SchedulerAgendaDateHeaderContext> | undefined>;
  emit<K extends keyof SchedulerOutputs>(name: K, payload: SchedulerOutputs[K]): void;
}

export interface SchedulerEventTemplateContext {
  $implicit: SchedulerOccurrence;
  /** Public form of the occurrence (source event or ExpandedEvent). */
  event: SchedulerEvent | ExpandedEvent;
  view: string;
  /** True for compact renderings (month rows, all-day band, timeline). */
  compact: boolean;
}

export interface SchedulerDayHeaderTemplateContext {
  $implicit: Date;
  view: string;
  today: boolean;
}

export interface SchedulerAgendaDateHeaderContext {
  $implicit: Date;
  events: (SchedulerEvent | ExpandedEvent)[];
  today: boolean;
}

/** What the popover currently shows, anchored to an element's viewport rect. */
export type PopoverState =
  | { kind: 'event'; occurrence: SchedulerOccurrence; anchor: DOMRect; sticky: boolean }
  | { kind: 'day'; date: Date; occurrences: SchedulerOccurrence[]; anchor: DOMRect; sticky: boolean };

/** Live drag preview: overrides one occurrence's position while dragging. */
export interface DragPreview {
  key: string;
  kind: 'move' | 'resize';
  start: Date;
  end: Date;
  /** Target resource row (timeline), when moved between rows. */
  resourceId?: string | number;
  fromResourceId?: string | number;
  /** False when `eventAllow` / min-max dates reject the target. */
  valid: boolean;
}

/** Current date selection (kept highlighted until cleared). */
export interface SchedulerSelection {
  start: Date;
  end: Date;
  allDay: boolean;
  resourceId?: string | number;
}

/**
 * Public, read-mostly API of a scheduler instance. Inject inside any part
 * projected into `<sch-scheduler>` with `injectSchedulerContext()`.
 */
export interface SchedulerContext {
  readonly view: Signal<string>;
  readonly date: Signal<Date>;
  readonly range: Signal<DateRange>;
  readonly title: Signal<string>;
  readonly views: Signal<readonly SchedulerViewDefinition[]>;
  readonly activeView: Signal<SchedulerViewDefinition | undefined>;
  readonly occurrences: Signal<readonly SchedulerOccurrence[]>;
  readonly resources: Signal<readonly SchedulerResource[]>;
  readonly options: Signal<SchedulerOptions>;
  readonly text: Signal<SchedulerText>;
  readonly selection: Signal<SchedulerSelection | null>;
  setView(view: string): void;
  setDate(date: Date): void;
  next(): void;
  prev(): void;
  today(): void;
  canNavigate(direction: 1 | -1): boolean;
  label(key: string, count?: number): string;
}

export const SCH_SCHEDULER_CONTEXT = new InjectionToken<SchedulerContext>('SCH_SCHEDULER_CONTEXT');

export function injectSchedulerContext(): SchedulerContext {
  return inject(SCH_SCHEDULER_CONTEXT);
}

let uid = 0;

@Injectable()
export class SchedulerStore implements SchedulerContext {
  private readonly hostRef = signal<SchedulerHost | null>(null);
  private readonly registered = inject(SCH_VIEWS, { optional: true }) ?? [];

  /** Every registered definition, de-duplicated by type (last registration wins). */
  private readonly registry = new Map(this.registered.map((v) => [v.type, v]));

  private host(): SchedulerHost {
    const h = this.hostRef();
    if (!h) throw new Error('SchedulerStore used outside <sch-scheduler>.');
    return h;
  }

  connect(host: SchedulerHost): void {
    this.hostRef.set(host);
  }

  // ---------------- configuration ----------------
  readonly options = computed(() => this.host().options());
  readonly text = computed(() => this.host().text());
  readonly resources = computed(() => this.host().resources());
  readonly headerToolbar = computed(() => this.host().headerToolbar());
  readonly eventTemplate = computed(() => this.host().eventTemplate());
  readonly dayHeaderTemplate = computed(() => this.host().dayHeaderTemplate());
  readonly agendaDateHeaderTemplate = computed(() => this.host().agendaDateHeaderTemplate());

  /** Views offered to the user: the `views` input order, limited to registered definitions. */
  readonly views = computed<readonly SchedulerViewDefinition[]>(() => {
    const wanted = this.host().views();
    if (!wanted?.length) return [...this.registry.values()];
    return wanted.map((t) => this.registry.get(t)).filter((v): v is SchedulerViewDefinition => !!v);
  });

  /** Requested view (any registered one), falling back to the first available view. */
  readonly activeView = computed(() => this.registry.get(this.host().view()) ?? this.views()[0]);
  readonly view = computed(() => this.activeView()?.type ?? this.host().view());
  readonly date = computed(() => this.host().date());

  readonly range = computed<DateRange>(() => {
    const v = this.activeView();
    const d = this.date();
    return v ? v.range(d, this.options()) : { start: d, end: d };
  });

  readonly title = computed(() => {
    const v = this.activeView();
    return v ? v.title(this.range(), this.date(), this.options()) : '';
  });

  // ---------------- events ----------------
  /** Working copy of the events: resets whenever the `events` input changes; mutated by drag/resize and methods. */
  readonly eventState = linkedSignal<readonly SchedulerEvent[]>(() => this.hostRef()?.events() ?? []);
  private readonly normalized = computed(() => normalizeEvents(this.eventState()));
  readonly occurrences = computed(() => expandOccurrences(this.normalized(), this.range()));

  readonly drag = signal<DragPreview | null>(null);

  /** Occurrences with the live drag preview applied. */
  readonly displayOccurrences = computed<readonly SchedulerOccurrence[]>(() => {
    const occs = this.occurrences();
    const d = this.drag();
    if (!d) return occs;
    return occs.map((o) => {
      if (o.key !== d.key) return o;
      let event = o.event;
      if (d.resourceId !== undefined && d.resourceId !== d.fromResourceId) {
        const ids = o.event.resourceIds.map((r) => (r === d.fromResourceId ? d.resourceId! : r));
        event = { ...o.event, resourceId: ids[0], resourceIds: ids.length ? ids : [d.resourceId] };
      }
      return { ...o, start: d.start, end: d.end, event };
    });
  });

  readonly selection = signal<SchedulerSelection | null>(null);

  // ---------------- navigation ----------------
  setView(view: string): void {
    if (!this.registry.has(view)) return;
    this.closePopover();
    this.host().view.set(view);
  }

  setDate(date: Date): void {
    const { minDate, maxDate } = this.options();
    let d = new Date(date);
    if (minDate && d < startOfDay(minDate)) d = startOfDay(minDate);
    if (maxDate && d > maxDate) d = startOfDay(maxDate);
    this.closePopover();
    this.host().date.set(d);
  }

  next(): void {
    this.step(1);
  }

  prev(): void {
    this.step(-1);
  }

  today(): void {
    this.setDate(new Date());
  }

  /** False when the adjacent range lies entirely outside `minDate`/`maxDate`. */
  canNavigate(direction: 1 | -1): boolean {
    const v = this.activeView();
    if (!v) return false;
    const { minDate, maxDate } = this.options();
    const target = v.step(this.date(), direction, this.options());
    const r = (v.period ?? v.range)(target, this.options());
    if (direction === -1 && minDate && r.end <= startOfDay(minDate)) return false;
    if (direction === 1 && maxDate && r.start > maxDate) return false;
    return true;
  }

  private step(dir: 1 | -1): void {
    const v = this.activeView();
    if (v && this.canNavigate(dir)) this.setDate(v.step(this.date(), dir, this.options()));
  }

  label(key: string, count = 0): string {
    const l = this.text()[key];
    if (typeof l === 'function') return l(count);
    return l ?? key;
  }

  // ---------------- permissions ----------------
  private interactive(): boolean {
    const o = this.options();
    return !o.disabled && !o.readonly;
  }

  canDrag(o: SchedulerOccurrence): boolean {
    const opts = this.options();
    if (!this.interactive()) return false;
    if (!(o.event.editable ?? opts.editable)) return false;
    return o.event.draggable ?? opts.eventStartEditable;
  }

  canResize(o: SchedulerOccurrence): boolean {
    const opts = this.options();
    if (!this.interactive()) return false;
    if (!(o.event.editable ?? opts.editable)) return false;
    return o.event.resizable ?? opts.eventDurationEditable;
  }

  canSelect(): boolean {
    return this.interactive() && this.options().selectable;
  }

  /** Outside `minDate`/`maxDate`. */
  isDateDisabled(day: Date): boolean {
    const { minDate, maxDate } = this.options();
    const d = startOfDay(day);
    return (!!minDate && d < startOfDay(minDate)) || (!!maxDate && d > startOfDay(maxDate));
  }

  private rangeAllowed(start: Date, end: Date): boolean {
    const { minDate, maxDate } = this.options();
    if (minDate && start < startOfDay(minDate)) return false;
    if (maxDate && end > addDays(startOfDay(maxDate), 1)) return false;
    return true;
  }

  colorOf(o: SchedulerOccurrence): string | null {
    if (o.event.color) return o.event.color;
    const rid = o.event.resourceId;
    if (rid === undefined) return null;
    return this.resourceById(rid)?.color ?? null;
  }

  resourceById(id: string | number | undefined): SchedulerResource | undefined {
    return id === undefined ? undefined : this.resources().find((r) => r.id === id);
  }

  original(o: SchedulerOccurrence): SchedulerOccurrence {
    return this.occurrences().find((x) => x.key === o.key) ?? o;
  }

  // ---------------- date click / selection ----------------
  dateClick(date: Date, allDay: boolean, jsEvent: Event, resourceId?: string | number): void {
    if (this.options().disabled || this.isDateDisabled(date)) return;
    this.host().emit('dateClick', {
      date,
      dateStr: toPayloadStr(date, allDay),
      allDay,
      jsEvent,
      resource: this.resourceById(resourceId),
      view: this.view(),
    });
  }

  /** Validates (min/max, selectAllow) and emits `dateSelect`; keeps the range selected. Returns false when rejected. */
  selectRange(start: Date, end: Date, allDay: boolean, jsEvent: Event | null, resourceId?: string | number): boolean {
    if (!this.canSelect() || !this.rangeAllowed(start, end)) return false;
    const allow = this.host().selectAllow();
    if (allow && !allow({ start, end, allDay, view: this.view(), resourceId })) return false;
    this.selection.set({ start, end, allDay, resourceId });
    this.host().emit('dateSelect', {
      start,
      end,
      startStr: toPayloadStr(start, allDay),
      endStr: toPayloadStr(end, allDay),
      allDay,
      jsEvent,
      resource: this.resourceById(resourceId),
      view: this.view(),
    });
    return true;
  }

  /** Live check used by views while dragging a selection. */
  isSelectionAllowed(start: Date, end: Date, allDay: boolean, resourceId?: string | number): boolean {
    if (!this.canSelect() || !this.rangeAllowed(start, end)) return false;
    const allow = this.host().selectAllow();
    return !allow || allow({ start, end, allDay, view: this.view(), resourceId });
  }

  unselect(): void {
    if (!this.selection()) return;
    this.selection.set(null);
    this.host().emit('dateUnselect', { view: this.view() });
  }

  // ---------------- event pointer lifecycle ----------------
  eventMouse(kind: 'enter' | 'leave', o: SchedulerOccurrence, el: HTMLElement, jsEvent: Event): void {
    this.host().emit(kind === 'enter' ? 'eventMouseenter' : 'eventMouseleave', {
      el,
      event: publicEvent(this.original(o)),
      jsEvent,
      view: this.view(),
    });
  }

  dragStart(o: SchedulerOccurrence, kind: 'move' | 'resize', el: HTMLElement | null, jsEvent: PointerEvent): void {
    this.closePopover();
    const event = publicEvent(o);
    if (kind === 'move') this.host().emit('eventDragStart', { event, el, jsEvent, view: this.view() });
    else this.host().emit('eventResizeStart', { event, el, jsEvent, view: this.view() });
  }

  /** Updates the preview; validates against min/max dates and `eventAllow`. */
  dragMove(
    o: SchedulerOccurrence,
    kind: 'move' | 'resize',
    start: Date,
    end: Date,
    jsEvent: PointerEvent,
    resourceId?: string | number,
    fromResourceId?: string | number,
  ): void {
    const allow = this.host().eventAllow();
    const targetResource = resourceId ?? o.event.resourceId;
    const valid =
      this.rangeAllowed(start, end) &&
      (!allow || allow({ start, end, allDay: o.event.allDay, resourceId: targetResource, view: this.view() }, publicEvent(o) as SchedulerEvent));
    this.drag.set({ key: o.key, kind, start, end, resourceId, fromResourceId, valid });
    const event = publicEvent(o);
    if (kind === 'move') {
      const ms = start.getTime() - o.start.getTime();
      this.host().emit('eventDrag', { event, delta: { days: diffDays(o.start, start), milliseconds: ms }, jsEvent, view: this.view() });
    } else {
      this.host().emit('eventResize', {
        event,
        startDelta: start.getTime() - o.start.getTime(),
        endDelta: end.getTime() - o.end.getTime(),
        jsEvent,
        view: this.view(),
      });
    }
  }

  /** Ends a drag/resize: applies a valid change to the working events and emits the result outputs. */
  dragEnd(o: SchedulerOccurrence, kind: 'move' | 'resize', jsEvent: PointerEvent | null): void {
    const d = this.drag();
    this.drag.set(null);
    const view = this.view();
    if (kind === 'move') this.host().emit('eventDragStop', { event: publicEvent(o), jsEvent, view });
    if (!d || !d.valid) return;
    const resourceChanged = d.resourceId !== undefined && d.resourceId !== d.fromResourceId;
    if (d.start.getTime() === o.start.getTime() && d.end.getTime() === o.end.getTime() && !resourceChanged) return;

    const { event, oldEvent, revert } = this.applyChange(o, d.start, d.end, resourceChanged ? d : undefined);
    if (kind === 'move') {
      this.host().emit('eventDrop', {
        event,
        oldEvent,
        newStart: d.start,
        newEnd: d.end,
        newResource: resourceChanged ? this.resourceById(d.resourceId) : undefined,
        delta: { days: diffDays(o.start, d.start), milliseconds: d.start.getTime() - o.start.getTime() },
        revert,
        view,
      });
    } else {
      this.host().emit('eventResizeStop', {
        event,
        oldEvent,
        startDelta: d.start.getTime() - o.start.getTime(),
        endDelta: d.end.getTime() - o.end.getTime(),
        revert,
        view,
      });
    }
    if (resourceChanged) {
      this.host().emit('eventResourceChange', {
        event,
        oldResource: this.resourceById(d.fromResourceId),
        newResource: this.resourceById(d.resourceId),
        view,
      });
    }
    this.host().emit('eventChange', { event, oldEvent });
  }

  dragCancel(o: SchedulerOccurrence, kind: 'move' | 'resize'): void {
    this.drag.set(null);
    if (kind === 'move') this.host().emit('eventDragStop', { event: publicEvent(o), jsEvent: null, view: this.view() });
  }

  /**
   * Writes a moved/resized occurrence back into the working events.
   * A recurring occurrence becomes an exception: its start is added to the series' `exdate`
   * and a standalone event (with `recurrenceId`) takes its place.
   */
  private applyChange(
    o: SchedulerOccurrence,
    start: Date,
    end: Date,
    res?: { resourceId?: string | number; fromResourceId?: string | number },
  ): { event: SchedulerEvent; oldEvent: SchedulerEvent | ExpandedEvent; revert: () => void } {
    const snapshot = this.eventState();
    const source = o.event.source;
    const oldEvent = publicEvent(o);
    const resourcePatch: Partial<SchedulerEvent> = {};
    if (res?.resourceId !== undefined) {
      if (source.resourceIds?.length) {
        resourcePatch.resourceIds = source.resourceIds.map((r) => (r === res.fromResourceId ? res.resourceId! : r));
      } else {
        resourcePatch.resourceId = res.resourceId;
      }
    }

    let event: SchedulerEvent;
    if (!o.recurring) {
      event = { ...source, start, end, ...resourcePatch };
      delete event.duration;
      this.eventState.set(snapshot.map((e) => (e === source ? event : e)));
    } else {
      const existing = Array.isArray(source.exdate) ? source.exdate : source.exdate ? [source.exdate] : [];
      const series: SchedulerEvent = { ...source, exdate: [...(existing as Date[]), o.start] };
      event = {
        ...source,
        ...resourcePatch,
        id: `${source.id}-${o.start.getTime()}`,
        start,
        end,
        recurrenceId: o.start,
        rrule: undefined,
        rdate: undefined,
        exdate: undefined,
      };
      delete event.duration;
      this.eventState.set([...snapshot.map((e) => (e === source ? series : e)), event]);
    }
    return { event, oldEvent, revert: () => this.eventState.set(snapshot) };
  }

  // ---------------- methods (exposed by the root component) ----------------
  addEvent(event: SchedulerEvent): void {
    this.eventState.update((list) => [...list, event]);
    this.host().emit('eventAdd', event);
  }

  updateEvent(event: SchedulerEvent): void {
    const old = this.getEventById(event.id);
    if (!old) return;
    this.eventState.update((list) => list.map((e) => (e.id === event.id ? event : e)));
    this.host().emit('eventChange', { event, oldEvent: old });
  }

  removeEvent(id: string | number): void {
    const old = this.getEventById(id);
    if (!old) return;
    this.eventState.update((list) => list.filter((e) => e.id !== id));
    this.host().emit('eventRemove', { event: old });
  }

  getEvents(): SchedulerEvent[] {
    return [...this.eventState()];
  }

  getEventById(id: string | number): SchedulerEvent | undefined {
    return this.eventState().find((e) => e.id === id);
  }

  // ---------------- event click / popover ----------------
  readonly popoverId = `sch-popover-${++uid}`;
  readonly popover = signal<PopoverState | null>(null);
  private showTimer: ReturnType<typeof setTimeout> | undefined;
  private hideTimer: ReturnType<typeof setTimeout> | undefined;

  /** Click / Enter on an event: emit `eventClick` and pin its details popover open. */
  activateEvent(occurrence: SchedulerOccurrence, jsEvent: Event, el: HTMLElement | null): void {
    if (this.options().disabled) return;
    const original = this.original(occurrence);
    this.host().emit('eventClick', { el, event: publicEvent(original), jsEvent, view: this.view() });
    if (!this.options().eventPopover || !el) return;
    clearTimeout(this.showTimer);
    this.cancelHide();
    this.popover.set({ kind: 'event', occurrence: original, anchor: el.getBoundingClientRect(), sticky: true });
  }

  eventDblclick(occurrence: SchedulerOccurrence, jsEvent: Event, el: HTMLElement | null): void {
    if (this.options().disabled) return;
    this.host().emit('eventDblclick', { el, event: publicEvent(this.original(occurrence)), jsEvent, view: this.view() });
  }

  /** Hover/focus on an event: show its details after the configured delay. */
  previewEvent(anchor: HTMLElement, occurrence: SchedulerOccurrence, immediate = false): void {
    const opts = this.options();
    if (!opts.eventPopover || this.drag()) return;
    const current = this.popover();
    if (current?.sticky) return;
    this.cancelHide();
    clearTimeout(this.showTimer);
    const show = () => {
      if (this.drag()) return;
      this.popover.set({ kind: 'event', occurrence: this.original(occurrence), anchor: anchor.getBoundingClientRect(), sticky: false });
    };
    if (immediate || current?.kind === 'event') show();
    else this.showTimer = setTimeout(show, opts.eventPopoverDelay);
  }

  /** Pointer/focus left an event or the popover: hide unless it was pinned open. */
  releasePreview(): void {
    clearTimeout(this.showTimer);
    if (this.popover()?.sticky) return;
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.popover.set(null), this.options().eventPopoverHideDelay);
  }

  cancelHide(): void {
    clearTimeout(this.hideTimer);
  }

  /** Emits `moreClick` and (with `showMorePopover`) pins the list of hidden occurrences. */
  more(
    anchor: HTMLElement,
    date: Date,
    hidden: SchedulerOccurrence[],
    all: SchedulerOccurrence[],
    jsEvent: Event,
    sourceView: MoreClickPayload['sourceView'],
    resourceId?: string | number,
  ): void {
    this.host().emit('moreClick', {
      date,
      events: all.map(publicEvent),
      jsEvent,
      resource: this.resourceById(resourceId),
      sourceView,
      view: this.view(),
    });
    if (!this.options().showMorePopover) return;
    clearTimeout(this.showTimer);
    this.cancelHide();
    this.popover.set({ kind: 'day', date, occurrences: hidden.map((o) => this.original(o)), anchor: anchor.getBoundingClientRect(), sticky: true });
  }

  closePopover(): void {
    clearTimeout(this.showTimer);
    this.cancelHide();
    this.popover.set(null);
  }

  /** Picking an item from the "+N more" list. */
  pickFromPopover(o: SchedulerOccurrence, jsEvent: Event): void {
    this.closePopover();
    this.host().emit('eventClick', { el: null, event: publicEvent(o), jsEvent, view: this.view() });
  }
}
