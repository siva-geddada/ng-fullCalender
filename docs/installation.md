# Installation

**Renaming from the earlier API:** package imports change from `ng-fullcalender` to `ngx-calendar-kit`; `<sch-scheduler>` becomes `<ngx-calendar>`; the `sch-` component selectors and `schEvent`-style directives become `ngx-calendar-` and `ngxCalendarEvent` respectively. `SchScheduler` becomes `NgxCalendar`, `SCHEDULER_IMPORTS` becomes `CALENDAR_IMPORTS`, and CSS `--sch-*` tokens become `--ngx-calendar-*`. The `SchedulerEvent` and other scheduling data types retain their names. These are breaking changes for existing consumers.

### From npm (after the package is published)

```bash
npm install ngx-calendar-kit
```

### From this Git repository

The library lives inside this Angular workspace, so build it first, then install the built package into your app:

```bash
git clone https://github.com/siva-geddada/ng-fullCalender.git
cd ng-fullCalender
npm ci
npx ng build ngx-calendar-kit                 # → dist/ngx-calendar-kit

cd /path/to/your-angular-app
npm install /path/to/ng-fullCalender/dist/ngx-calendar-kit
# or: cd dist/ngx-calendar-kit && npm pack, then npm install the generated .tgz
```
