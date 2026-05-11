# Timer / GOTO update notes

This project now uses `timeDeltaMinutes` on each answer choice.

- Costs are negative values, e.g. `[costs 5 min]` uses `"timeDeltaMinutes": -5`.
- Bonuses are positive values, e.g. `[+3 min bonus]` uses `"timeDeltaMinutes": 3`.
- Zero-cost answers use `"timeDeltaMinutes": 0`.

The timer subtracts/adds time as soon as the participant selects an answer, then routes to the answer's `gotoPage`, `nextPage`, or the page's `defaultNextPage`.

The timeout and path-complete overlay sends participants to the post-game questionnaire. The CSV export button appears only after the post-game questions are completed.
