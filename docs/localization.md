# Localization

```html
<sch-scheduler
  locale="de-DE"
  [firstDayOfWeek]="1"
  [timeFormat]="{ format: '24h' }"
  [text]="{ today: 'Heute', month: 'Monat', week: 'Woche', day: 'Tag', year: 'Jahr', allDay: 'Ganztägig', more: moreText }"
/>
```

```ts
moreText = (n: number) => `+${n} weitere`;
```

The default English text is exported as `DEFAULT_TEXT`, and its keys are typed by `SchedulerText`.
