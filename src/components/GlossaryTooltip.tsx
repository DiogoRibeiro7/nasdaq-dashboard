"use client";

import type { JSX } from "react";
import { getGlossaryEntry, type GlossaryId } from "@/lib/glossary";

export type GlossaryTooltipProps = {
  entryId: GlossaryId;
};

export function GlossaryTooltip({
  entryId,
}: GlossaryTooltipProps): JSX.Element | null {
  const entry = getGlossaryEntry(entryId);
  if (!entry) {
    return null;
  }

  const label = `What is ${entry.title}?`;

  return (
    <span
      className="inline-flex items-center"
      aria-label={label}
      title={`${entry.title}: ${entry.description}`}
    >
      <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-700 text-[10px] font-semibold text-neutral-200">
        ?
      </span>
      <span className="sr-only">{entry.description}</span>
    </span>
  );
}
