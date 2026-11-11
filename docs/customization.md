# Templates & custom parts

```html
<ngx-calendar [events]="events()">
  <!-- Event body (all views) -->
  <ng-template ngxCalendarEvent let-occ let-event="event" let-compact="compact">
    <strong>{{ event.title }}</strong>
  </ng-template>

  <!-- Day headers (week/day columns, month cells) -->
  <ng-template ngxCalendarDayHeader let-date let-today="today">{{ date | date: 'EEE d' }}</ng-template>

  <!-- Agenda date headers -->
  <ng-template ngxCalendarAgendaDateHeader let-date let-events="events">
    {{ date | date: 'fullDate' }} · {{ events.length }}
  </ng-template>
</ngx-calendar>
```

**Your own toolbar or view:** place any component inside `<ngx-calendar>` and call `injectSchedulerContext()` from `ngx-calendar-kit/context`. It exposes `view()`, `date()`, `range()`, `title()`, `occurrences()`, `selection()`, `next()`, `prev()`, `today()` and `setView()`. A custom view is a `SchedulerViewDefinition` (`type`, `labelKey`, `component`, `range`, `step`, `title`, plus optional `period` and `data`) registered with `provideSchedulerView()`.
