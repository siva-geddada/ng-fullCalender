# Events, resources & recurrence

### `SchedulerEvent`

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string \| number` | Required |
| `title` | `string` | |
| `start` | `string \| Date` | `Date`, ISO string, or `YYYY-MM-DD` (read as local midnight) |
| `end` | `string \| Date` | Exclusive. If missing: `start + duration`, else 1 day (all-day) or 1 hour |
| `allDay` | `boolean` | |
| `duration` | `number` | Minutes; used when `end` is missing |
| `color`, `textColor`, `borderColor` | `string` | Any CSS color. `color` falls back to the resource color, then the accent |
| `className` | `string` | Added to the event element |
| `editable`, `draggable`, `resizable` | `boolean` | Override `editable`, `eventStartEditable` and `eventDurationEditable` for this event |
| `resourceId` / `resourceIds` | `string \| number` / `(string \| number)[]` | Timeline rows; an event with several resources appears in each row |
| `rrule` | `string \| RRuleOptions` | `'FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10'` or `{ freq: 'WEEKLY', byDay: ['MO','WE'], count: 10 }` |
| `exdate` / `rdate` | `Date[] \| string` | Occurrence starts to skip or add (a string is comma-separated) |
| `recurrenceId` | `string \| Date` | Set on exceptions (the original occurrence start) |
| `categoryId(s)`, `timezone`, `metadata` | | Passed through untouched |

### `SchedulerResource`

```ts
{ id: 'eng', title: 'Engineering', color: '#4b57d1' }
```

### Recurrence

| Part | Values |
| --- | --- |
| `FREQ` | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` |
| `INTERVAL` | every *n* periods |
| `COUNT` | total occurrences, counted from `start` |
| `UNTIL` | `YYYYMMDD`, `YYYYMMDDTHHmmss`, or `…Z` (UTC) |
| `BYDAY` | `SU,MO,TU,WE,TH,FR,SA` (weekly rules) |

Payloads describe an occurrence of a series as an `ExpandedEvent` (`id`, `originalId`, `isRecurring`, `originalStart`, …). A non-recurring event is passed as your original object.
