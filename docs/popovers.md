# Popovers

| Action | Result |
| --- | --- |
| Hover an event (`[eventPopover]="true"`) | After `eventPopoverDelay` ms, a preview card shows time, date, duration, resource and whether it repeats |
| Tab to an event | The same card, linked to the event with `aria-describedby` |
| Click an event or press Enter on it | Fires `eventClick` and pins the card, with a close button |
| Click "+N more" (`showMorePopover`) | Opens a list of the day's hidden events; clicking the link again closes it |
| Escape, a click outside, scrolling, or navigating | Closes the popover |

`eventPopoverPosition` (`'right'` by default, or `'left'`, `'top'`, `'bottom'`) sets the preferred side. If the card doesn't fit there, it flips to the opposite side.
