# Handling user actions

The scheduler keeps a **working copy** of `events`. Drags, resizes and the `addEvent`/`updateEvent`/`removeEvent` methods change that copy, and the scheduler reports each change. Any new value you pass to `[events]` replaces the working copy.

```html
<sch-scheduler
  #scheduler
  [events]="events()"
  [editable]="true"
  (dateClick)="onDateClick($event)"
  (dateSelect)="onSelect($event)"
  (eventClick)="open($event.event)"
  (eventDrop)="onDrop($event)"
  (eventResizeStop)="onResize($event)"
  (eventChange)="events.set(scheduler.getEvents())"
/>
```

```ts
onSelect(s: SchedulerDateSelectPayload) {
  // s.start, s.end, s.allDay, s.startStr / s.endStr (ISO), s.resource (timeline row), s.view
  this.scheduler().addEvent({ id: crypto.randomUUID(), title: 'New event', start: s.start, end: s.end, allDay: s.allDay });
  this.scheduler().unselect();
}

async onDrop(d: EventDropPayload) {
  // d.event (new), d.oldEvent, d.newStart, d.newEnd, d.newResource, d.delta { days, milliseconds }
  try {
    await this.api.save(d.event);
  } catch {
    d.revert(); // put it back
  }
}
```

**Recurring events:** dragging or resizing one occurrence adds its start to the series' `exdate` and creates a standalone event (with `recurrenceId`) in its place.

**Rules:**
- `editable` (off by default) turns on drag and resize. `eventStartEditable` and `eventDurationEditable` control them separately, and an event's own `editable`, `draggable` and `resizable` override all three.
- `readonly` blocks edits and selection but keeps navigation and clicks. `disabled` blocks every interaction inside the view.
- `eventAllow(dropInfo, event)` and `selectAllow(selectInfo)` can reject a drop or a selection. A rejected target shows a dashed red outline.
- `minDate` and `maxDate` disable dates, limit navigation, and reject drops and selections outside the range.
