"use client";

import type { JSX } from "react";
import {
  findGlossaryEntry,
  type GlossaryTermId,
} from "@/lib/glossary";

export type GlossaryTooltipProps = {
  termId: GlossaryTermId;
  fallbackLabel?: string;
};

export function GlossaryTooltip({
  termId,
  fallbackLabel = "Definition",
}: GlossaryTooltipProps): JSX.Element {
  const entry = findGlossaryEntry(termId);
  const label = entry?.term ?? fallbackLabel;
  const body = entry?.shortDefinition ?? "See glossary for details.";

  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-600 text-[10px] font-semibold text-neutral-200"
      aria-label={`${label}: ${body}`}
      title={`${label}: ${body}`}
    >
      i
    </span>
  );
}
