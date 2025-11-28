# Nasdaq Stock Dashboard

A modern stock dashboard built with Next.js, TypeScript, and Tailwind CSS. Track daily prices, analyze risk/return metrics, and compare relative performance across NASDAQ stocks.

## Features

- **Single Stock View** - Daily closing price chart with configurable time ranges (1M, 3M, 6M, 1Y, MAX)
- **Risk/Return Metrics** - Last close price, 1-month return, 3-month return, and annualized volatility
- **Multi-Stock Comparison** - Compare up to 4 stocks with normalized performance (base = 1)
- **20 NASDAQ Stocks** - Curated list including AAPL, MSFT, GOOGL, AMZN, NVDA, TSLA, and more

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Data Source**: Yahoo Finance (via `yahoo-finance2`)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd nasdaq-dashboard-alpha-vantage
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── api/stocks/[symbol]/   # Stock data API endpoint
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Home page
├── components/
│   ├── StockDashboard.tsx     # Main dashboard component
│   ├── StockChart.tsx         # Single stock price chart
│   ├── MultiStockChart.tsx    # Multi-stock comparison chart
│   ├── StockSelector.tsx      # Single stock dropdown
│   ├── MultiStockSelector.tsx # Multi-stock checkbox selector
│   └── StatsCards.tsx         # Statistics display cards
└── lib/
    ├── types.ts               # Shared TypeScript types
    ├── yahooFinance.ts        # Yahoo Finance API client
    ├── stats.ts               # Statistics calculations
    └── stocks.ts              # Stock ticker definitions
```

## API

### `GET /api/stocks/[symbol]`

Fetches daily OHLC data for a stock symbol.

**Response:**

```json
{
  "symbol": "AAPL",
  "lastRefreshed": "2024-01-15",
  "series": [
    {
      "date": "2024-01-15",
      "open": 183.92,
      "high": 185.10,
      "low": 182.73,
      "close": 185.92,
      "adjustedClose": 185.92,
      "volume": 65076900
    }
  ]
}
```

**Errors:**

- `400` - Symbol not in allowed list
- `500` - Failed to fetch data

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import repository in Vercel
3. Deploy

No environment variables are required - Yahoo Finance doesn't need an API key.

### Other Platforms

Build and start:

```bash
npm run build
npm run start
```

## License

MIT
