export type StockTicker = {
  symbol: string;
  name: string;
};

export const NASDAQ_STOCKS: StockTicker[] = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)" },
  { symbol: "AMZN", name: "Amazon.com, Inc." },
  { symbol: "META", name: "Meta Platforms, Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "NFLX", name: "Netflix, Inc." },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc." },
  { symbol: "CSCO", name: "Cisco Systems, Inc." },
  { symbol: "PEP", name: "PepsiCo, Inc." },
  { symbol: "COST", name: "Costco Wholesale Corporation" },
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "QCOM", name: "QUALCOMM Incorporated" },
  { symbol: "TXN", name: "Texas Instruments Incorporated" },
  { symbol: "PYPL", name: "PayPal Holdings, Inc." },
  { symbol: "INTU", name: "Intuit Inc." },
  { symbol: "AMAT", name: "Applied Materials, Inc." }
];
