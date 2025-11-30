"use client";

import type { JSX } from "react";
import { glossaryEntries } from "@/lib/glossary";

export function GlossaryPanel(): JSX.Element {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="mb-3">
        <h2 className="text-base font-medium text-neutral-200">Glossary</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Quick definitions for every chart and metric on the dashboard.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {glossaryEntries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4"
          >
            <h3 className="text-sm font-semibold text-neutral-100">
              {entry.title}
            </h3>
            <p className="mt-1 text-xs text-neutral-400">
              {entry.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
