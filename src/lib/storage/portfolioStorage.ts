export interface SavedPortfolio {
  id: string;
  name: string;
  symbols: string[];
  weights: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export class PortfolioStorage {
  private readonly STORAGE_KEY = 'stock_portfolios';
  private readonly MAX_PORTFOLIOS = 20;

  /**
   * Get all saved portfolios from localStorage
   */
  getAllPortfolios(): SavedPortfolio[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return [];
      }

      const portfolios = JSON.parse(stored) as SavedPortfolio[];
      // Ensure the data structure is valid
      return Array.isArray(portfolios) ? portfolios : [];
    } catch (error) {
      console.error('Error loading portfolios:', error);
      return [];
    }
  }

  /**
   * Save a new portfolio to localStorage
   */
  savePortfolio(portfolio: SavedPortfolio): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const existing = this.getAllPortfolios();

      // Check if we've reached the maximum number of portfolios
      if (existing.length >= this.MAX_PORTFOLIOS) {
        throw new Error(`Maximum of ${this.MAX_PORTFOLIOS} portfolios reached. Please delete some portfolios first.`);
      }

      // Check for duplicate IDs
      if (existing.some(p => p.id === portfolio.id)) {
        throw new Error('Portfolio with this ID already exists');
      }

      const updated = [...existing, portfolio];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      if (error instanceof Error && error.message.includes('Maximum')) {
        throw error;
      }
      console.error('Error saving portfolio:', error);
      throw new Error('Failed to save portfolio');
    }
  }

  /**
   * Delete a portfolio by ID
   */
  deletePortfolio(id: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const existing = this.getAllPortfolios();
      const filtered = existing.filter(p => p.id !== id);

      if (filtered.length === existing.length) {
        throw new Error('Portfolio not found');
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      throw new Error('Failed to delete portfolio');
    }
  }

  /**
   * Update an existing portfolio
   */
  updatePortfolio(id: string, updates: Partial<Omit<SavedPortfolio, 'id' | 'createdAt'>>): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const existing = this.getAllPortfolios();
      const index = existing.findIndex(p => p.id === id);

      if (index === -1) {
        throw new Error('Portfolio not found');
      }

      existing[index] = {
        ...existing[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existing));
    } catch (error) {
      console.error('Error updating portfolio:', error);
      throw new Error('Failed to update portfolio');
    }
  }

  /**
   * Export all portfolios as JSON string
   */
  exportPortfolios(): string {
    const portfolios = this.getAllPortfolios();
    return JSON.stringify(portfolios, null, 2);
  }

  /**
   * Import portfolios from JSON string
   */
  importPortfolios(jsonString: string, replace: boolean = false): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const imported = JSON.parse(jsonString) as SavedPortfolio[];

      if (!Array.isArray(imported)) {
        throw new Error('Invalid portfolio data format');
      }

      // Validate each portfolio
      for (const portfolio of imported) {
        if (!portfolio.id || !portfolio.name || !Array.isArray(portfolio.symbols)) {
          throw new Error('Invalid portfolio structure');
        }
      }

      if (replace) {
        // Replace all existing portfolios
        if (imported.length > this.MAX_PORTFOLIOS) {
          throw new Error(`Cannot import more than ${this.MAX_PORTFOLIOS} portfolios`);
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(imported));
      } else {
        // Merge with existing portfolios
        const existing = this.getAllPortfolios();
        const existingIds = new Set(existing.map(p => p.id));

        // Filter out duplicates and add new ones
        const newPortfolios = imported.filter(p => !existingIds.has(p.id));
        const merged = [...existing, ...newPortfolios];

        if (merged.length > this.MAX_PORTFOLIOS) {
          throw new Error(`Importing would exceed maximum of ${this.MAX_PORTFOLIOS} portfolios`);
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
      }
    } catch (error) {
      console.error('Error importing portfolios:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to import portfolios');
    }
  }

  /**
   * Clear all portfolios
   */
  clearAllPortfolios(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing portfolios:', error);
      throw new Error('Failed to clear portfolios');
    }
  }

  /**
   * Get a single portfolio by ID
   */
  getPortfolioById(id: string): SavedPortfolio | null {
    const portfolios = this.getAllPortfolios();
    return portfolios.find(p => p.id === id) || null;
  }
}

// Export a singleton instance
export const portfolioStorage = new PortfolioStorage();