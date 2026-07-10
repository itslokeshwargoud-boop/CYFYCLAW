"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import type { PromptTemplate } from "@/lib/types";
import { fetchTemplates } from "@/lib/api";
import { useStore } from "@/lib/store";

// Used until the backend template list loads (or if it is unavailable).
const FALLBACK: Pick<PromptTemplate, "id" | "title" | "prompt">[] = [
  { id: "analyze-datadog-rule", title: "Analyze this Datadog rule", prompt: "Analyze this Datadog Security Monitoring rule and produce the full review:\n\n" },
  { id: "reduce-false-positives", title: "Reduce false positives", prompt: "Reduce false positives for this rule without reducing detection coverage. Justify every exclusion:\n\n" },
  { id: "review-sigma", title: "Review Sigma rule", prompt: "Review this Sigma rule and recommend production-ready tuning:\n\n```yaml\n\n```" },
  { id: "map-mitre", title: "Map to MITRE ATT&CK", prompt: "Map this detection to MITRE ATT&CK techniques (IDs + rationale). Flag any weak mappings:\n\n" },
];

export default function SuggestedPrompts() {
  const [templates, setTemplates] = useState(FALLBACK);
  const setDraft = useStore((s) => s.setDraft);

  useEffect(() => {
    let alive = true;
    fetchTemplates()
      .then((t) => {
        if (alive && t.length) setTemplates(t.slice(0, 6));
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mb-8 flex flex-col items-center"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-teal/40 bg-teal/10 text-teal-bright">
          <ShieldCheck size={24} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-text">
          Detection Engineering, tuned for production
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted">
          Paste a Datadog rule, Sigma rule, OCSF query, or logs. CyfyClaw reduces
          false positives without sacrificing coverage.
        </p>
      </motion.div>

      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDraft(t.prompt)}
            className="rounded-lg border border-border bg-panel px-4 py-3 text-left text-sm text-text transition-colors hover:border-teal hover:bg-panel-2"
          >
            {t.title}
          </button>
        ))}
      </div>
    </div>
  );
}
