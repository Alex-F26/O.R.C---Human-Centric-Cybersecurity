# Wrong Answer Repeat Logic

This version adds `advanceOnSelect` metadata for answer choices.

- `advanceOnSelect: true` means the action is valid and the survey should move forward or follow `gotoPage`.
- `advanceOnSelect: false` means the action is wrong/ineffective. The timer still applies `timeDeltaMinutes`, but the participant stays on the same question and can try again.

This keeps the timer realistic: wrong actions waste time without advancing the scenario.

The logic is modular. Future paths can use the same field:

```json
{
  "value": "wrong_action",
  "text": "Try an ineffective action [costs 5 min]",
  "timeDeltaMinutes": -5,
  "advanceOnSelect": false
}
```

Choices without `advanceOnSelect` default to advancing, so older groupmate files will still work until they are updated.

The selected wrong answer is cleared after the time penalty so the participant can choose again. The wrong choice is still logged in the CSV choice history, including 0-minute choices.
