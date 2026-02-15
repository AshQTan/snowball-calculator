# Snowball

A client-side compound wealth calculator that projects portfolio value over time. Configure one or more investment funds with different contribution strategies, return rates, and starting balances, then visualize how they compound year by year. Everything runs in the browser — no server, database, or account required.

Built with React, TypeScript, Vite, Tailwind CSS, and Recharts.

## Features

### Strategy & Portfolio Modeling

Create and compare multiple investment strategies side-by-side. Each strategy represents a distinct portfolio configuration (e.g., "Safe Scenarios", "Aggressive Growth") containing one or more funds. Strategies can be duplicated, renamed, and color-coded for easy comparison.

### Multi-Fund Portfolios

Within each strategy, set up multiple funds (e.g. 401k, IRA, brokerage), each with its own name, color, starting balance, contribution schedule, and expected return rate. Useful for modeling diversified portfolios. Funds include preset return rates (Conservative 5%, Moderate 7%, Aggressive 10%, S&P 500 Historical 10.5%) and a color picker with six presets plus custom hex input.

### Flexible Contributions

- **Fixed or income-based**: Contribute a flat dollar amount, or allocate a percentage of your annual income.
- **Monthly or annual frequency**: Choose how often contributions are made.
- **Contribution escalation**: Increase contributions over time by a fixed dollar amount or a percentage, on a configurable interval (e.g., raise contributions 3% every 2 years). Income-based contributions grow automatically with income.

### Timeline Modes

- **Years**: Project growth over a specified number of years (1–60), with a range slider for quick adjustment.
- **Retirement age**: Set your current age and target retirement age, and the calculator figures out the horizon for you.

### Inflation Adjustment

Enter an expected inflation rate to see projections in today's dollars. Toggle between nominal and real (inflation-adjusted) values at any time. An orange badge indicates when inflation adjustment is active.

### Income Modeling

Specify your current annual income and an expected growth rate. Funds configured with percentage-of-income contributions adjust automatically as income grows. A warning banner appears if total annual contributions across all funds exceed projected income.

### Interactive Charts

- **Projection chart**: Switch between line (area) and bar chart modes.
  - **Strategy Comparison**: When multiple strategies exist, view their growth curves overlaid on the same chart.
  - **Detailed Breakdown**: For single strategies, view by Fund, or by Contribution vs Interest.
- **Composition chart**: Horizontal stacked bar showing portfolio composition at any given year, with a year slider to scrub through the timeline. View in combined mode (starting/contributions/interest) or by fund, with detail cards showing values and percentages.

### Milestones

Built-in milestone markers at key thresholds ($10K, $25K, $50K, $100K, $250K, $500K, $1M, $2.5M, $5M, $10M) appear on the projection chart when crossed. Create custom milestones with a name, target amount, and emoji icon (choose from 16 options). Custom milestones are displayed as clickable badges below the chart.

### Summary Statistics

At-a-glance metrics including:

- Final balance (nominal or real, with year count)
- Total amount invested (starting balance + contributions breakdown)
- Total interest earned (with percentage of total)
- Effective CAGR (compound annual growth rate) with tooltip explanation
- Estimated doubling time (Rule of 72)

### Year-by-Year Schedule

A detailed table breaking down each year's starting balance, contributions, interest, and ending balance. For multi-fund portfolios, three view modes are available: combined (with expandable per-fund detail rows), by fund (columnar), and fund × type (split with sub-headers). Rows are highlighted when milestones are reached. Includes an inflation-adjusted column when enabled, and pagination with a "Show All" toggle.

### PDF Export

Generate a clean, print-friendly PDF report of your current projection and schedule.

### Dark Mode

Toggle between light and dark themes. Preference is persisted to `localStorage` and applied before first paint to avoid flash.

### Shareable Links

The full calculator state is serialized into the URL. Copy the link to share a specific scenario or bookmark it for later. No server or account required.

### CSV Export

Export the year-by-year schedule as a `.csv` file for use in spreadsheets or further analysis.

## Getting Started

```bash
npm install
npm run dev
```

The app runs locally at `http://localhost:5173` by default.

### Build for Production

```bash
npm run build
npm run preview
```

## Tech Stack

| Layer       | Technology          |
| ----------- | ------------------- |
| UI          | React 18            |
| Language    | TypeScript          |
| Build       | Vite                |
| Styling     | Tailwind CSS        |
| Charts      | Recharts            |
| Icons       | Lucide React        |
