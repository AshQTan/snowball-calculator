# Snowball

A client-side investment growth calculator that projects portfolio value over time. Configure one or more funds with different contribution strategies and return rates, then visualize how they compound year by year.

Built with React, TypeScript, Vite, Tailwind CSS, and Recharts.

## Features

### Multi-Fund Support

Set up multiple funds, each with its own starting balance, contribution schedule, and expected return rate. Useful for modeling diversified portfolios or comparing strategies side by side.

### Flexible Contributions

- **Fixed or income-based**: Contribute a flat dollar amount, or allocate a percentage of your annual income.
- **Monthly or annual frequency**: Choose how often contributions are made.
- **Contribution growth**: Increase contributions over time by a fixed dollar amount or a percentage, on a configurable interval (e.g., raise contributions 3% every 2 years).

### Timeline Modes

- **Years**: Project growth over a specified number of years.
- **Retirement age**: Set your current age and target retirement age, and the calculator figures out the horizon for you.

### Inflation Adjustment

Enter an expected inflation rate to see projections in today's dollars. Toggle between nominal and real (inflation-adjusted) values at any time.

### Income Modeling

Specify your current annual income and an expected growth rate. Funds configured with percentage-of-income contributions will adjust automatically as income grows.

### Interactive Charts

- **Projection chart**: Line or bar chart showing total portfolio value over time, with milestone markers at key thresholds ($100K, $250K, $500K, $1M, etc.).
- **Composition chart**: Stacked area chart showing how each fund contributes to the overall portfolio.

### Summary Statistics

At-a-glance metrics including:

- Final balance (nominal or real)
- Total amount invested (starting balance + contributions)
- Total interest earned
- Effective CAGR (compound annual growth rate)
- Estimated doubling time (Rule of 72)

### Year-by-Year Schedule

A detailed table breaking down each year's starting balance, contributions, interest, and ending balance — with per-fund detail.

### Shareable Links

The full calculator state is serialized into the URL. Copy the link to share a specific scenario or bookmark it for later. No server or account required.

### CSV Export

Export the year-by-year schedule as a CSV file for use in spreadsheets or further analysis.

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
