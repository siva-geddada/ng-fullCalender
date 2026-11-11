# Working on the library

```
.
├── projects/ngx-calendar-kit/        # the library
│   ├── src/lib/core/                 # Angular-free logic: dates, normalization, layout, recurrence
│   ├── src/lib/state/                # store, context, text, view registry
│   ├── src/lib/components/           # root, toolbar, body, popover, templates
│   ├── src/lib/views/                # time grid, month, year, agenda, timeline
│   ├── src/styles/                   # SCSS tokens, themes and per-view styles
│   └── views/*, context/, module/    # secondary entry points
├── src/                              # demo app
└── docs/images/                      # screenshots used in this README
```

| Task | Command |
| --- | --- |
| Install | `npm ci` |
| Build the library | `npx ng build ngx-calendar-kit` (add `--watch` while developing) |
| Run the demo | `npx ng serve sample` |
| Tests | `npx ng test ngx-calendar-kit --watch=false` and `npx ng test sample --watch=false` |

A one-off `ng build` wipes `dist/` and breaks a running `ng serve`. Use `--watch`, or restart the dev server after a build.

**Publishing:** run `npx ng build ngx-calendar-kit`, then `cd dist/ngx-calendar-kit`, `npm pack --dry-run`, `npm login` and `npm publish --access public`.
