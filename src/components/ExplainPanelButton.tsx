"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { findGlossaryEntry } from "@/lib/glossary";

export type ExplainPanelButtonProps = {
  title: string;
  summary: string;
  termIds: string[];
};

export function ExplainPanelButton({
  title,
  summary,
  termIds,
}: ExplainPanelButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const entries = termIds
    .map((id) => findGlossaryEntry(id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-neutral-700/70 px-2 py-0.5 text-[11px] font-semibold text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-50"
      >
        Explain this
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-neutral-700 bg-neutral-900 p-5 text-sm text-neutral-200 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Explain this panel
                </p>
                <h3 className="text-lg font-semibold text-neutral-50">{title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-neutral-700/70 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-500 hover:text-neutral-50"
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm text-neutral-300">{summary}</p>
            {entries.length > 0 && (
              <div className="mt-4 space-y-3 text-sm">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3"
                  >
                    <div className="text-xs font-semibold text-neutral-100">
                      {entry.term}
                    </div>
                    <p className="mt-1 text-[13px] text-neutral-300">
                      {entry.shortDefinition}
                    </p>
                    <Link
                      href={`/glossary#${entry.id}`}
                      className="mt-2 inline-flex text-[12px] font-semibold text-sky-300 hover:text-sky-200"
                      onClick={() => setOpen(false)}
                    >
                      Read more →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
