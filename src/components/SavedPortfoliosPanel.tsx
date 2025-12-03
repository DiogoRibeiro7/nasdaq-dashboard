"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX, ChangeEvent } from "react";
import { portfolioStorage, type SavedPortfolio } from "@/lib/storage/portfolioStorage";
import type { TargetWeights } from "@/lib/analytics/portfolio_backtest";

export type SavedPortfoliosPanelProps = {
  currentSymbols: string[];
  currentWeights: TargetWeights | null;
  onLoadPortfolio: (portfolio: SavedPortfolio) => void;
};

export function SavedPortfoliosPanel({
  currentSymbols,
  currentWeights,
  onLoadPortfolio,
}: SavedPortfoliosPanelProps): JSX.Element | null {
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPortfolios(portfolioStorage.getAllPortfolios());
  }, []);

  if (typeof window === "undefined") {
    return null;
  }

  const refresh = (): void => {
    setPortfolios(portfolioStorage.getAllPortfolios());
  };

  const handleSave = (): void => {
    setError(null);
    setSuccessMessage(null);

    if (!currentWeights || currentSymbols.length === 0) {
      setError("Select at least two symbols and configure weights before saving.");
      return;
    }

    const trimmedName = name.trim() || `Portfolio ${portfolios.length + 1}`;
    const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random());
    const timestamp = new Date().toISOString();

    const portfolio: SavedPortfolio = {
      id,
      name: trimmedName,
      symbols: currentSymbols,
      weights: currentWeights,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      portfolioStorage.savePortfolio(portfolio);
      setName("");
      setSuccessMessage(`Portfolio "${trimmedName}" saved successfully!`);
      refresh();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save portfolio');
    }
  };

  const handleDelete = (id: string): void => {
    try {
      portfolioStorage.deletePortfolio(id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete portfolio');
    }
  };

  const handleExport = (): void => {
    if (portfolios.length === 0) {
      return;
    }

    try {
      const jsonString = portfolioStorage.exportPortfolios();
      const blob = new Blob([jsonString], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `portfolios_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMessage('Portfolios exported successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export portfolios');
    }
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      setSuccessMessage(null);

      try {
        const jsonString = reader.result as string;
        portfolioStorage.importPortfolios(jsonString, false);
        refresh();
        setSuccessMessage('Portfolios imported successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import portfolios');
      }

      event.target.value = "";
    };

    reader.readAsText(file);
  };

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-medium text-neutral-200">
            Saved Portfolios
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Store up to 20 portfolio configurations locally, load them later, or share via JSON.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-100 transition-colors hover:border-neutral-500"
            disabled={portfolios.length === 0}
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-100 transition-colors hover:border-neutral-500"
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800/60 bg-neutral-950/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-semibold text-neutral-400">
            Portfolio name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My portfolio"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500"
            />
          </label>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg border border-sky-600/60 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition-colors hover:border-sky-400 hover:text-sky-50 disabled:opacity-40"
            disabled={!currentWeights || currentSymbols.length < 2}
          >
            Save Portfolio
          </button>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}
        {successMessage && (
          <p className="mt-2 text-xs text-green-400">
            {successMessage}
          </p>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {portfolios.length === 0 ? (
          <div className="rounded-xl border border-neutral-800/60 bg-neutral-950/30 p-4 text-sm text-neutral-400">
            No saved portfolios yet.
          </div>
        ) : (
          portfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              className="flex flex-col gap-2 rounded-xl border border-neutral-800/60 bg-neutral-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-neutral-100">
                  {portfolio.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {portfolio.symbols.join(", ")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => onLoadPortfolio(portfolio)}
                  className="rounded-lg border border-neutral-700 px-3 py-1.5 font-medium text-neutral-100 transition-colors hover:border-neutral-500"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(portfolio.id)}
                  className="rounded-lg border border-red-900/60 px-3 py-1.5 font-medium text-red-200 transition-colors hover:border-red-600 hover:text-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
