# Height & layout

| Setting | Result |
| --- | --- |
| *(nothing)* | Height comes from width ÷ `aspectRatio` (default `1.2`) |
| `height="parent"` | Fills its parent (`100%`). Give the parent a height, or make the scheduler a flex child with `flex: 1; min-height: 0` |
| `[height]="720"` | Fixed height in pixels |
| `height="calc(100vh - 4rem)"` | Any CSS length |
| `height="auto"` or `[autoHeight]="true"` | Grows with its content. Views don't scroll internally; month cells show `maxEventsVisible` rows |
| `[autoHeight]="{ minHeight: 400, maxHeight: 900 }"` | Auto height with limits |

Month rows always stretch to fill the height. The number of event rows per cell is whatever fits the measured row height, capped by `maxEventsVisible`. The rest of the day's events go into "+N more".

A full-page calendar:

```scss
.page {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}

.page ngx-calendar {
  flex: 1 1 auto;
  min-height: 0;
}
```

```html
<div class="page">
  <app-header />
  <ngx-calendar height="parent" [events]="events()" />
</div>
```
