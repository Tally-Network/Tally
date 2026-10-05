"use client";
import React, { useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
        catch { /* clipboard refused: the command stays selectable */ }
      }}
      className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 font-inter text-xs text-neutral-600 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
      aria-label={done ? "Copied" : `${label} command`}
    >
      {done ? <IconCheck className="size-3.5" /> : <IconCopy className="size-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}
