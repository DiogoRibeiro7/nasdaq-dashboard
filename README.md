# Nasdaq Dashboard (Next.js + Alpha Vantage)

Simple Nasdaq stock dashboard built with Next.js (App Router), TypeScript,
Tailwind CSS and Recharts, using Alpha Vantage as the data source.

Features:

- Single-ticker view with daily price chart.
- Basic risk/return metrics (1M, 3M returns and annualised volatility).
- Multi-stock comparison chart, normalised to 1 at the start of the
  selected time range.
- Tickers restricted to a fixed list of ~20 Nasdaq stocks.

## Getting started

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Create a `.env.local` file in the project root and add your Alpha Vantage API key:

   ```env
   ALPHA_VANTAGE_API_KEY=your_real_key_here
   ```

3. Run the development server:

   ```bash
   yarn dev
   ```

   Then open http://localhost:3000 in your browser.

4. To deploy on Vercel:

   - Push this repository to GitHub.
   - Import the repo in Vercel.
   - Add `ALPHA_VANTAGE_API_KEY` in the project environment variables.
   - Deploy.

## Notes

- Alpha Vantage free tier is rate-limited (5 requests/minute, 500/day).
  The code uses Next.js caching (`revalidate: 900`) on the server-side
  requests to mitigate this.
