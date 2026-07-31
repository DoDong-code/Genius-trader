# Design QA

## Source of truth

- `C:/Users/ADMINI~1/AppData/Local/Temp/codex-clipboard-c1823040-97ae-4466-b95d-df25c785e0d5.png`
- `C:/Users/ADMINI~1/AppData/Local/Temp/codex-clipboard-d564faa8-6715-4543-b805-ab78fe7d84d1.jpg`

## Implementation evidence

- Screenshot: `C:/Users/Administrator/Desktop/Codex3 基金/design-implementation.png`
- Side-by-side comparison: `C:/Users/Administrator/Desktop/Codex3 基金/design-qa-comparison.png`
- Viewport: 1280 × 720 CSS pixels
- State: account 2 fund detail drawer, 近1月 range, 历史净值 tab

## Comparison

The implementation follows the reference information architecture while preserving the existing Apple-style white interface:

- Historical chart remains the primary visual.
- Range controls provide 近1月、近3月、近6月、近1年、近3年.
- Historical performance and historical NAV are separate, directly switchable views.
- Historical NAV exposes date, unit NAV, accumulated NAV, and daily change.
- Positive and negative values retain the product's established market colors.
- The drawer owns vertical scrolling while the background portfolio remains fixed.

## Severity review

- P0: none.
- P1: none.
- P2: none.
- P3: none blocking delivery.

## Interaction verification

- Range changes update the chart title, date interval, point set, and return.
- Historical performance values are calculated from the real NAV series.
- Historical NAV rows are populated from the real API response.
- Drawer scrolling and background scroll locking behave correctly.
- Reduced-motion behavior is preserved.

## Validation

- `pnpm run build`: passed.
- `pnpm test`: passed, 5 tests.
- Real API history payload: 450 records for fund `022184`.

final result: passed
