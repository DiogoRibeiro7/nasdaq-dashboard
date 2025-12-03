"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX, ChangeEvent } from "react";
import { PortfolioStorage, type SavedPortfolio } from "@/lib/storage/portfolioStorage";
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
  const storage = useMemo(() => new PortfolioStorage(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPortfolios(storage.getAllPortfolios());
  }, [storage]);

  if (typeof window === "undefined") {
    return null;
  }

  const refresh = (): void => {
    setPortfolios(storage.getAllPortfolios());
  };

  const handleSave = (): void => {
    setError(null);
    if (!currentWeights || currentSymbols.length === 0) {
      setError("Select at least two symbols and configure weights before saving.");
      return;
    }
    if (currentSymbols.length > 4) {
      setError("Saved portfolios currently support up to 4 symbols.");
      return;
    }
    if (portfolios.length >= 20) {
      setError("Maximum of 20 saved portfolios reached. Delete one before saving.");
      return;
    }
    const trimmedName = name.trim() || `Portfolio ${portfolios.length + 1}`;
    const id =
      globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random());
    const timestamp = new Date().toISOString();
    const portfolio: SavedPortfolio = {
      id,
      name: trimmedName,
      symbols: currentSymbols,
      weights: currentWeights,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    storage.savePortfolio(portfolio);
    setName("");
    refresh();
  };

  const handleDelete = (id: string): void => {
    storage.deletePortfolio(id);
    refresh();
  };

  const handleExport = (): void => {
    if (portfolios.length === 0) {
      return;
    }
    const blob = new Blob([JSON.stringify(portfolios, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "saved_portfolios.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      try {
        const imported = JSON.parse(reader.result as string) as SavedPortfolio[];
        if (!Array.isArray(imported)) {
          throw new Error("Invalid format");
        }
        let merged = [...portfolios];
        for (const entry of imported) {
          if (merged.length >= 20) break;
          if (
            entry &&
            Array.isArray(entry.symbols) &&
            typeof entry.weights === "object"
          ) {
            const normalized = {
              ...entry,
              id:
                entry.id ??
                globalThis.crypto?.randomUUID?.() ??
                String(Math.random()),
              createdAt: entry.createdAt ?? new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            merged.push(normalized);
          }
        }
        storage.replaceAll(merged);
      } catch {
        setError("Failed to import portfolios. Ensure the JSON structure is valid.");
      }
      refresh();
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
