# Templates & custom parts

```html
<sch-scheduler [events]="events()">
  <!-- Event body (all views) -->
  <ng-template schEvent let-occ let-event="event" let-compact="compact">
    <strong>{{ event.title }}</strong>
  </ng-template>

  <!-- Day headers (week/day columns, month cells) -->
  <ng-template schDayHeader let-date let-today="today">{{ date | date: 'EEE d' }}</ng-template>

  <!-- Agenda date headers -->
  <ng-template schAgendaDateHeader let-date let-events="events">
    {{ date | date: 'fullDate' }} · {{ events.length }}
  </ng-template>
</sch-scheduler>
```

**Your own toolbar or view:** place any component inside `<sch-scheduler>` and call `injectSchedulerContext()` from `ng-scheduler-kit/context`. It exposes `view()`, `date()`, `range()`, `title()`, `occurrences()`, `selection()`, `next()`, `prev()`, `today()` and `setView()`. A custom view is a `SchedulerViewDefinition` (`type`, `labelKey`, `component`, `range`, `step`, `title`, plus optional `period` and `data`) registered with `provideSchedulerView()`.
