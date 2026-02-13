# Scenario Comparison Feature

## Overview

Allow users to define multiple investment scenarios (e.g., "Conservative", "Aggressive", "Max 401k") that share the same global settings but have independent fund configurations. This enables apples-to-apples comparison of different strategies under identical conditions.

---

## State Model

### Current

```ts
interface AppState {
  global: GlobalSettings;
  funds: Fund[];
  chartMode: ChartMode;
  customMilestones: CustomMilestone[];
}
```

### Proposed

```ts
interface Scenario {
  id: string;
  name: string;           // user-editable label, e.g. "Aggressive"
  color: string;          // scenario-level color for comparison overlays
  funds: Fund[];
}

interface AppState {
  global: GlobalSettings;
  scenarios: Scenario[];
  activeScenarioId: string;
  chartMode: ChartMode;
  customMilestones: CustomMilestone[];
}
```

**Key decisions:**

- `global` stays shared across all scenarios — timeline, inflation, income, age. This ensures comparisons are meaningful.
- Each scenario has its own `funds[]`, which is the only thing that varies between strategies.
- `activeScenarioId` controls which scenario is being edited and shown in detail views.
- When only 1 scenario exists, the app looks and behaves exactly like it does today — no visible comparison UI.

### Scenario Colors

Each scenario gets a distinct primary color from a dedicated palette, intentionally different from the fund color palette to avoid confusion between fund-level and scenario-level coloring:

```ts
// Fund colors (existing) — used for individual fund identity within a scenario
const FUND_COLORS = ['#38bdf8', '#f87171', '#2dd4bf', '#fb923c', '#a78bfa', '#f472b6'];

// Scenario colors (new) — used for comparison overlays, lines, badges
const SCENARIO_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
```

The scenario palette uses bolder, more saturated tones that read well as thin overlay lines and small badges, while the fund palette uses lighter tones suited for filled chart areas. The two palettes share no exact values.

These scenario colors are used only for comparison overlays (chart lines, summary badges, table column headers). Individual fund colors within a scenario are independent and drawn from `FUND_COLORS` as today.

Color assignment: new scenarios pick the first color from `SCENARIO_COLORS` not currently in use. If all 5 are taken (max scenarios reached), assignment is moot since the `[+]` button is disabled.

---

## UI Changes

### Funds Panel (Left Sidebar)

A tab bar appears above the funds list when 2+ scenarios exist:

```
┌─────────────────────────────────────────┐
│  [Aggressive ●] [Conservative] [+]     │
├─────────────────────────────────────────┤
│  Fund configurations for active tab... │
└─────────────────────────────────────────┘
```

- Each tab shows the scenario name and a colored dot matching its scenario color.
- The active tab is highlighted; clicking another tab switches the editable scenario.
- The `[+]` button adds a new scenario (duplicates the active scenario's funds as a starting point, so users can tweak from a baseline rather than starting from scratch). The new scenario is named "{SourceName} (copy)", truncated if needed.
- Right-clicking or long-pressing a tab opens options: **Rename**, **Duplicate**, **Delete** (disabled if only 1 scenario remains).
- When only 1 scenario exists, no tab bar is shown — the panel looks identical to today.
- **Mobile:** On narrow screens (< 640px), the tab bar scrolls horizontally with overflow. Scenario names are truncated with ellipsis at ~12 characters. The `[+]` button stays pinned to the right.

### Projection Chart

#### Line Mode

- **Active scenario:** Full stacked area fill (starting balance / contributions / interest), exactly as today.
- **Inactive scenarios:** A single total-balance line each, using the scenario's color. Line style differentiates them (solid for scenario 2, dashed for scenario 3, etc.).
- **Crossover indicator:** If two scenario lines cross, a small dot and label mark the point (e.g., "Crossover yr 12"). Useful for answering "when does strategy A pull ahead of strategy B?"

```
  $
  │            ╱ Aggressive (filled area)
  │          ╱
  │        ╱
  │      ╱·····  Conservative (dashed line)
  │    ╱·····
  │  ╱···
  │╱·
  └──────────────── Year
```

#### Bar Mode

- **Active scenario:** Stacked bar (starting / contributions / interest) as today.
- **Inactive scenarios:** Grouped beside the active bar, shown as a solid-color bar using the scenario color. Keeps the chart readable without too many stacked segments.
- **3+ scenarios:** Grouped bars will get narrow with many scenarios × many years. Auto-increase the X-axis tick interval, and consider capping visible grouped bars at 3 (active + 2 most recently added). Alternatively, show only the active scenario's bars with overlaid total-balance lines for the rest, mirroring line mode's approach.

#### Tooltip (Both Modes)

Shows all scenarios at the hovered year, sorted by balance descending:

```
┌──────────────────────────────────────────┐
│ Year 15                                  │
│                                          │
│ ● Aggressive          $485,230           │
│   Starting             $40,000           │
│   Contributions       $180,000           │
│   Interest            $265,230           │
│                                          │
│ ● Conservative        $312,100           │
│                                          │
│ Difference           +$173,130  (+55.5%) │
└──────────────────────────────────────────┘
```

The active scenario shows its full breakdown; inactive scenarios show only the total balance. A difference row appears when exactly 2 scenarios exist.

#### Milestones

Displayed only for the active scenario to avoid visual clutter.

#### Legend

Scenario names appear as additional legend entries with their line style (solid/dashed) and color.

### Composition Chart

#### Single Scenario

No change from today.

#### Multiple Scenarios

Vertically stacked comparison with **proportional-width bars**:

```
Aggressive   |████████████████████████████████████████████|  $500,230
              Starting   Contributions       Interest

Conservative |██████████████████████████████            |    $312,100
              Starting   Contributions  Interest

                                                    [── Year 12 ──]
```

**Critical design detail:** Bar widths are proportional to each scenario's total balance. The largest scenario gets 100% width; others scale relative to it. This prevents the misleading visual equivalence that would occur if all bars were the same width.

- Hovering a scenario's bar shows the detail cards (Starting / Contributions / Interest breakdown) for that scenario.
- The year slider updates all bars simultaneously.
- Dollar totals are displayed at the right of each bar.

### Summary Stats

The 4 stat cards (Final Balance, Total Invested, Interest Earned, Growth CAGR) show the **active scenario's** values.

When 2+ scenarios exist, a compact comparison strip appears below the stat cards:

```
┌──────────────────────────────────────────────────────────────┐
│  ● Aggressive: $485,230    ● Conservative: $312,100         │
│  ██████████████████████    ██████████████████                │
│                            Δ -$173,130 (-35.7%)             │
└──────────────────────────────────────────────────────────────┘
```

- Each scenario shows its name, color dot, and final balance.
- The bar widths are proportional to balance (same principle as composition chart).
- When exactly 2 scenarios exist, a delta value and percentage are shown.
- Clicking a scenario in this strip switches the active scenario.

### Schedule Table

The table shows the **active scenario's** full breakdown (Start, Contribution, Interest, End Balance, Growth %).

When 2+ scenarios exist, additional columns appear at the right:

| Year | Start | Contrib | Interest | End Balance | Conservative | Δ |
|------|-------|---------|----------|-------------|-------------|----------|
| 1    | ...   | ...     | ...      | $13,840     | $12,620     | +$1,220  |
| 5    | ...   | ...     | ...      | $78,400     | $62,100     | +$16,300 |
| 10   | ...   | ...     | ...      | $195,600    | $142,300    | +$53,300 |

- One column per inactive scenario showing its end balance for that year.
- A delta column (Δ) when exactly 2 scenarios exist.
- Column headers use the scenario color for quick identification.
- **3+ scenarios:** The table can get wide. At 3+ inactive scenarios, collapse comparison columns behind an expandable "Compare" toggle to keep the default view readable.

---

## Computation

No changes to the projection engine. `computeProjection` accepts an `AppState`-like input and returns a `ProjectionResult`. For comparison, we simply run it once per scenario:

```ts
const results = state.scenarios.map((scenario) =>
  computeProjection({
    global: state.global,
    funds: scenario.funds,
    customMilestones: state.customMilestones,
  })
);
```

Results are memoized via a single `useMemo` keyed on `[state.scenarios, state.global, state.customMilestones]`. Since global settings and milestones are shared, any change to them invalidates all scenarios — per-scenario caching would add complexity for marginal gain.

To minimize component churn during migration, derive a convenience accessor early:

```ts
const activeScenario = state.scenarios.find(s => s.id === state.activeScenarioId)!;
const activeFunds = activeScenario.funds;
```

Most existing components can continue consuming `Fund[]` via `activeFunds` without needing to know about scenarios.

---

## URL Sharing

The URL encoding extends to include multiple scenarios:

```
?tm=years&y=10&...&s=[{n:"Aggressive",c:"#38bdf8",f:[...]},{n:"Conservative",c:"#34d399",f:[...]}]&as=0
```

- `s` replaces `f` — array of scenario objects, each containing a name, color, and funds array.
- `as` — active scenario index.
- Backward compatibility: if the URL contains `f` (old format), treat it as a single unnamed scenario.
- **URL length risk:** 5 scenarios × multiple funds can exceed the ~2000-character practical URL limit in some browsers. If the encoded URL exceeds 1800 characters, fall back to copying a shortened payload (e.g., base64-encoded, compressed JSON) or show a warning that the link may not work in all browsers. For v1, just document the limit and revisit if it becomes a real problem.

---

## Edge Cases

| Situation | Behavior |
|---|---|
| Only 1 scenario | No comparison UI shown; app looks identical to current version |
| Scenarios with 0 funds | Prevented — cannot delete the last fund in a scenario |
| Very large balance differences (10x+) | Proportional bars still work; the smaller bar will be quite narrow but the dollar label remains visible |
| Many scenarios (4+) | Allow up to 5 scenarios max; the `[+]` button disables at the limit |
| Deleting the active scenario | Active switches to the first remaining scenario |
| Crossover detection | Only computed and shown for pairs; if 3+ scenarios exist, crossovers are between each inactive scenario and the active one |
| Duplicate naming | New scenario is named "{SourceName} (copy)". If that name already exists, append a number: "(copy 2)", "(copy 3)", etc. |
| Renaming to empty string | Prevented — revert to previous name if the user clears the input and blurs |

---

## Export Behavior

### CSV

- **Single scenario:** No change from today — exports the active scenario's schedule.
- **Multiple scenarios:** Export all scenarios. Each scenario gets a section separated by a blank row, with a header row showing the scenario name. Column structure is identical to today's single-scenario export.

### PDF (Print)

- Uses the current on-screen view, which already includes comparison elements (overlay lines, comparison strip, etc.) when multiple scenarios exist. No special handling needed — `window.print()` captures whatever is rendered.

---

## Design Notes

- **`chartMode` is intentionally global** — switching the active scenario tab should not flip between line and bar chart. All scenarios share the same chart mode.
- **Crossover detection** is deferred to after the core feature (step 8). It requires sub-year linear interpolation between data points for precision and only applies to line mode. Skip it for the initial release if needed.

---

## Implementation Order

1. **State migration** — Add `Scenario` type, convert `funds[]` → `scenarios[]` with a single default scenario. Update `getDefaultState`, `stateToURL`, `stateFromURL`. Expose `activeFunds` accessor so existing components can consume `Fund[]` unchanged. This is the highest-risk step — get it solid before touching UI.
2. **Funds panel tabs** — Tab bar UI, add/rename/duplicate/delete scenario actions.
3. **Multi-scenario computation** — Run `computeProjection` per scenario, memoize results.
4. **Summary stats comparison strip** — Compact bar with proportional widths and delta.
5. **Projection chart overlays** — Inactive scenario lines (line mode) and grouped bars (bar mode), updated tooltip.
6. **Composition chart stacking** — Proportional-width vertical comparison bars.
7. **Schedule table columns** — Inactive scenario balance + delta columns.
8. **Crossover detection** — Find and annotate crossover points on the projection chart.
