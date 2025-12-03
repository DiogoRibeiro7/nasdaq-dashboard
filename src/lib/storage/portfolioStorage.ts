export interface SavedPortfolio {
  id: string;
  name: string;
  symbols: string[];
  weights: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export class PortfolioStorage {
  private readonly STORAGE_KEY = "stock_portfolios";

  private get storage(): Storage | null {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage;
  }

  private read(): SavedPortfolio[] {
    const store = this.storage;
    if (!store) return [];
    const raw = store.getItem(this.STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as SavedPortfolio[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    } catch {
      return [];
    }
  }

  private write(portfolios: SavedPortfolio[]): void {
    const store = this.storage;
    if (!store) return;
    store.setItem(this.STORAGE_KEY, JSON.stringify(portfolios));
  }

  getAllPortfolios(): SavedPortfolio[] {
    return this.read();
  }

  savePortfolio(portfolio: SavedPortfolio): void {
    const portfolios = this.read();
    const index = portfolios.findIndex((item) => item.id === portfolio.id);
    if (index >= 0) {
      portfolios[index] = portfolio;
    } else {
      portfolios.push(portfolio);
    }
    this.write(portfolios);
  }

  deletePortfolio(id: string): void {
    const portfolios = this.read().filter((portfolio) => portfolio.id !== id);
    this.write(portfolios);
  }

  replaceAll(portfolios: SavedPortfolio[]): void {
    this.write(portfolios);
  }

  updatePortfolio(
    id: string,
    updates: Partial<SavedPortfolio>,
  ): void {
    const portfolios = this.read();
    const index = portfolios.findIndex((portfolio) => portfolio.id === id);
    if (index === -1) {
      return;
    }
    portfolios[index] = {
      ...portfolios[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.write(portfolios);
  }
}
