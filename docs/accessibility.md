# Accessibility

- Week/day slots, month cells and year days use roving focus: arrow keys move, Home/End jump within a day, and Enter/Space emits `dateClick` and `dateSelect`.
- Events are focusable and work with Enter/Space. Their details card is linked with `aria-describedby`, and a pinned card is a `dialog`.
- "+N more" reports `aria-expanded`, and its list closes with Escape.
- Every cell has a full date (and time) `aria-label`. Disabled dates report `aria-disabled`.
- The toolbar title is announced on navigation, and the view dropdown has a label.
- Animations are turned off for users who prefer reduced motion.
