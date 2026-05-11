# advanceOnSelect Coverage Report
Every radiogroup answer choice in the survey JSON files now has an explicit `advanceOnSelect` field.
- Existing `advanceOnSelect: false` values were preserved.
- Existing `advanceOnSelect: true` values were preserved.
- Choices that were missing the field were set to `advanceOnSelect: true` to preserve the current path/branch behavior.

## Files updated
- `base.json`: added field to 12 choices
- `path_csrf.json`: added field to 30 choices
- `path_oscmd.json`: added field to 0 choices
- `path_sqli.json`: added field to 57 choices
- `path_xss.json`: added field to 0 choices
- `questions.json`: added field to 0 choices

## Current totals
- `base.json`: total choices 12, true 12, false 0, missing 0
- `path_csrf.json`: total choices 30, true 30, false 0, missing 0
- `path_oscmd.json`: total choices 117, true 78, false 39, missing 0
- `path_sqli.json`: total choices 57, true 57, false 0, missing 0
- `path_xss.json`: total choices 59, true 28, false 31, missing 0
- `questions.json`: total choices 0, true 0, false 0, missing 0
