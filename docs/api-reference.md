# API reference

### Inputs

| Input | Type | Default |
| --- | --- | --- |
| **Data** | | |
| `events` | `SchedulerEvent[]` | `[]` |
| `resources` | `SchedulerResource[]` | `[]` |
| `view` (two-way) | `SchedulerViewType` | `'month'` |
| `date` (two-way) | `Date` | today |
| `views` | `SchedulerViewType[]` | `['month','week','day','year','agenda']` |
| **Layout** | | |
| `height` | `number \| 'auto' \| 'parent' \| string` | — |
| `aspectRatio` | `number` (width ÷ height) | `1.2` |
| `autoHeight` | `boolean \| AutoHeightOptions` | `false` |
| `headerToolbar` | `false \| { left, center, right }` | `{ left: 'prev,next today', center: 'title', right: 'month,week,day' }` |
| `theme` | `'light' \| 'dark' \| 'auto'` | `'light'` |
| `ariaLabel` | `string` | `'Scheduler'` |
| **Time & locale** | | |
| `locale` | `string` | browser |
| `timeFormat` | `{ format: '12h' \| '24h' \| 'auto' }` | `auto` |
| `firstDayOfWeek` | `0`–`6` | `0` |
| `slotDuration` | minutes (`5,10,15,20,30,60`) | `30` |
| `slotMinTime` / `slotMaxTime` | `'HH:mm'` | `'00:00'` / `'24:00'` |
| `snapDuration` | minutes | `slotDuration` |
| `scrollTime` | `'HH:mm'` | `'08:00'` |
| `daysOfWeek` | `number[]` | all |
| `numberOfDays` | `number` | — |
| `businessHours` | `boolean \| BusinessHoursConfig \| BusinessHoursConfig[]` | `false` (`true` = Mon–Fri 09:00–17:00) |
| `showBusinessHours` | `boolean` | `true` |
| `weekNumbers` / `weekNumbering` | `boolean` / `'auto' \| 'iso' \| 'us'` | `false` / `'iso'` |
| `nowIndicator` / `nowIndicatorInterval` | `boolean` / ms | `true` / `60000` |
| `minDate` / `maxDate` | `Date \| string \| null` | — |
| `navLinks` | `boolean` (day numbers open the day view) | `false` |
| **Interaction** | | |
| `editable` | `boolean` | `false` |
| `eventStartEditable` / `eventDurationEditable` | `boolean` | `true` / `true` |
| `selectable` | `boolean` | `true` |
| `readonly` / `disabled` | `boolean` | `false` / `false` |
| `dragMinDistance` | px | `5` |
| `eventAllow` / `selectAllow` | callbacks | — |
| **Month / agenda** | | |
| `maxEventsVisible` | `number` | `5` |
| `showMorePopover` | `boolean` | `true` |
| `agendaDays` | `number` | `30` |
| `showEmptyDays` | `boolean` | `false` |
| `noEventsMessage` | `string` | — |
| **Popovers** | | |
| `eventPopover` | `boolean` | `false` |
| `eventPopoverDelay` / `eventPopoverHideDelay` | ms | `300` / `100` |
| `eventPopoverPosition` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'right'` |
| **Timeline** | | |
| `timelineSlotDuration` | minutes | `60` |
| `timelineSnapDuration` | minutes | `timelineSlotDuration` |
| `timelineSlotWidth` | px | `112` |
| `timelineMinTime` / `timelineMaxTime` | `'HH:mm'` | `slotMinTime` / `slotMaxTime` |
| `resourceAreaWidth` | px | `200` |
| `resourceRowHeight` | px | `48` |
| `resourceAreaHeaderContent` | `string` | `'Resources'` |
| **Text** | | |
| `text` | `Partial<SchedulerText>` | English |

### Outputs

| Output | Payload |
| --- | --- |
| `dateClick` | `{ date, dateStr, allDay, jsEvent, resource?, view }` |
| `dateSelect` | `{ start, end, startStr, endStr, allDay, jsEvent, resource?, view }` |
| `dateUnselect` | `{ view }` |
| `eventClick` / `eventDblclick` | `{ el, event, jsEvent, view }` |
| `eventMouseenter` / `eventMouseleave` | `{ el, event, jsEvent, view }` |
| `eventDragStart` / `eventDragStop` | `{ event, el?, jsEvent, view }` |
| `eventDrag` | `{ event, delta, jsEvent, view }` (while dragging) |
| `eventDrop` | `{ event, oldEvent, newStart, newEnd, newResource?, delta, revert, view }` |
| `eventResizeStart` | `{ event, el, jsEvent, view }` |
| `eventResize` | `{ event, startDelta, endDelta, jsEvent, view }` (while resizing) |
| `eventResizeStop` | `{ event, oldEvent, startDelta, endDelta, revert, view }` |
| `eventResourceChange` | `{ event, oldResource?, newResource?, view }` |
| `eventChange` | `{ event, oldEvent }` (after any drop, resize or `updateEvent`) |
| `eventAdd` / `eventRemove` | `event` / `{ event }` |
| `moreClick` | `{ date, events, jsEvent, resource?, sourceView, view }` |
| `datesChange` | `{ start, end }` (visible range) |
| `viewStateChange` | `{ dateRange, view }` |
| `viewChange` / `dateChange` | from the `[(view)]` / `[(date)]` bindings |

### Methods

Reach them with a template reference (`#s="ngxCalendar"`, or `#s` on the element) or `viewChild(NgxCalendar)`:

| Method | |
| --- | --- |
| `addEvent(event)`, `updateEvent(event)`, `removeEvent(id)` | Change the working copy and emit `eventAdd` / `eventChange` / `eventRemove` |
| `getEvents()`, `getEventById(id)` | Read the working copy |
| `getResources()`, `getResourceById(id)` | |
| `changeView(view)`, `getView()` | |
| `gotoDate(date \| 'YYYY-MM-DD')`, `getDate()`, `getDateRange()` | |
| `next()`, `prev()`, `today()` | |
| `select(start, end)`, `unselect()`, `clearSelection()` | |

### Toolbar

`headerToolbar` sections accept `prev`, `next`, `today`, `title` and view names. A comma joins items into one group and a space separates groups. View names are shown as a dropdown. Use `<ngx-calendar-toolbar switcher="buttons" />` for a row of buttons instead. Set `[headerToolbar]="false"` to hide the toolbar.

```ts
headerToolbar = { left: 'prev,next today', center: 'title', right: 'month,week,day,year,agenda,timelineWeek' };
```
