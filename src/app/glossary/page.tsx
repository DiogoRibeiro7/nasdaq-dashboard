"use client";

import type { JSX } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { GLOSSARY_ENTRIES } from "@/lib/glossary";

export default function GlossaryPage(): JSX.Element {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");

  const categories = useMemo(() => {
    const unique = new Set<string>();
    for (const entry of GLOSSARY_ENTRIES) {
      if (entry.category) {
        unique.add(entry.category);
      }
    }
    return ["All", ...Array.from(unique).sort((a, b) => a.localeCompare(b))];
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY_ENTRIES.filter((entry) => {
      const matchesCategory =
        category === "All" || entry.category === category;
      const matchesQuery =
        q.length === 0 ||
        entry.term.toLowerCase().includes(q) ||
        entry.shortDefinition.toLowerCase().includes(q) ||
        entry.longDefinition.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 text-neutral-100">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-neutral-400">
            Explainability
          </p>
          <h1 className="text-3xl font-semibold">Analytics Glossary</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Search or filter by category to learn how each metric on the dashboard is defined.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center text-sm text-sky-300 hover:text-sky-200"
        >
          ← Back to dashboard
        </Link>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-300 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-neutral-400">
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. volatility, VaR..."
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
          />
        </label>
        <label className="flex w-full flex-col gap-1 text-xs font-medium text-neutral-400 sm:w-52">
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {filtered.map((entry) => (
          <article
            key={entry.id}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5"
          >
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              {entry.category ?? "Concept"}
            </div>
            <h2 className="text-lg font-semibold text-neutral-100">
              {entry.term}
            </h2>
            <p className="mt-2 text-sm text-neutral-300">
              {entry.longDefinition}
            </p>
            {entry.formulaLatex && (
              <pre className="mt-3 rounded-lg bg-neutral-950/70 p-3 text-xs text-neutral-200">
                {entry.formulaLatex}
              </pre>
            )}
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5 text-sm text-neutral-400">
            No entries match that search. Try a different keyword.
          </div>
        )}
      </section>
    </main>
  );
}
