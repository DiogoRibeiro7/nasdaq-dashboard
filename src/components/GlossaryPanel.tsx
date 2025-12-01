"use client";

import type { JSX } from "react";
import Link from "next/link";
import { GLOSSARY_ENTRIES } from "@/lib/glossary";

const FEATURED_IDS = [
  "volatility_annualised",
  "sharpe_ratio",
  "value_at_risk",
  "expected_shortfall",
];

export function GlossaryPanel(): JSX.Element {
  const featured = GLOSSARY_ENTRIES.filter((entry) =>
    FEATURED_IDS.includes(entry.id),
  );

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-medium text-neutral-200">
            Need a refresher?
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Look for the inline “i” icons next to any metric to read the short definition,
            or open the full glossary for longer explanations and formulas.
          </p>
        </div>
        <Link
          href="/glossary"
          className="inline-flex items-center rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-100 transition-colors hover:border-neutral-500"
        >
          Browse Glossary →
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {featured.map((entry) => (
          <article
            key={entry.id}
            className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4"
          >
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              {entry.category ?? "Concept"}
            </div>
            <h3 className="text-sm font-semibold text-neutral-100">
              {entry.term}
            </h3>
            <p className="mt-1 text-xs text-neutral-400">
              {entry.shortDefinition}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
