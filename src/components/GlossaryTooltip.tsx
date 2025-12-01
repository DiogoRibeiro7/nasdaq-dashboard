"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import {
  findGlossaryEntry,
  type GlossaryTermId,
} from "@/lib/glossary";

const PLACEMENT_CLASSES: Record<
  NonNullable<GlossaryTooltipProps["placement"]>,
  string
> = {
  top: "bottom-full mb-2 left-1/2 -translate-x-1/2",
  bottom: "top-full mt-2 left-1/2 -translate-x-1/2",
  left: "right-full mr-2 top-1/2 -translate-y-1/2",
  right: "left-full ml-2 top-1/2 -translate-y-1/2",
};

export type GlossaryTooltipProps = {
  termId: GlossaryTermId;
  fallbackLabel?: string;
  placement?: "top" | "bottom" | "left" | "right";
};

export function GlossaryTooltip({
  termId,
  fallbackLabel = "Definition",
  placement = "top",
}: GlossaryTooltipProps): JSX.Element {
  const entry = findGlossaryEntry(termId);
  const label = entry?.term ?? fallbackLabel;
  const body = entry?.shortDefinition ?? "See glossary for details.";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent): void {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const tooltipContent = `${label}: ${body}`;

  return (
    <div className="relative inline-block">
      <button
        type="button"
        ref={ref}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-neutral-600/70 text-[10px] font-semibold text-neutral-200 hover:border-neutral-400 hover:text-neutral-50 focus:border-sky-400 focus:text-sky-200"
        aria-label={tooltipContent}
        aria-expanded={open}
      >
        i
      </button>
      {open && (
        <div
          className={`absolute z-30 w-60 rounded-lg border border-neutral-700 bg-neutral-950/95 p-3 text-left text-[11px] text-neutral-100 shadow-lg ${PLACEMENT_CLASSES[placement]}`}
        >
          <div className="text-xs font-semibold text-neutral-50">{label}</div>
          <p className="mt-1 text-[11px] leading-snug text-neutral-300">
            {body}
          </p>
          <a
            href={`/glossary#${termId}`}
            className="mt-2 inline-flex text-[11px] font-semibold text-sky-300 hover:text-sky-200"
          >
            Read more →
          </a>
        </div>
      )}
    </div>
  );
}
