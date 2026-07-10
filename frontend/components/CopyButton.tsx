"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface Props {
  text: string;
  className?: string;
  label?: string;
}

export default function CopyButton({ text, className = "", label }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — silently ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-text hover:border-teal ${className}`}
      aria-label={label ?? "Copy"}
    >
      {copied ? (
        <Check size={13} className="text-success" />
      ) : (
        <Copy size={13} />
      )}
      {label ? <span>{copied ? "Copied" : label}</span> : null}
    </button>
  );
}
