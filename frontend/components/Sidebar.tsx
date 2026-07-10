"use client";

import { useEffect, useState } from "react";
import {
  BookMarked,
  ChevronLeft,
  ChevronRight,
  Library,
  MessageSquare,
  Plus,
  ShieldCheck,
} from "lucide-react";
import type { DetectionRule, PromptTemplate } from "@/lib/types";
import { fetchDetections, fetchTemplates } from "@/lib/api";
import { useStore } from "@/lib/store";

export default function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const conversations = useStore((s) => s.conversations);
  const activeId = useStore((s) => s.activeId);
  const newConversation = useStore((s) => s.newConversation);
  const selectConversation = useStore((s) => s.selectConversation);
  const setDraft = useStore((s) => s.setDraft);

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [detections, setDetections] = useState<DetectionRule[]>([]);

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => setTemplates([]));
    fetchDetections().then(setDetections).catch(() => setDetections([]));
  }, []);

  if (collapsed) {
    return (
      <aside className="flex h-full w-14 flex-none flex-col items-center border-r border-border bg-panel py-3">
        <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-md border border-teal/40 bg-teal/10 text-teal-bright">
          <ShieldCheck size={17} />
        </div>
        <button
          type="button"
          onClick={newConversation}
          className="mb-2 flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-teal hover:text-text"
          aria-label="New analysis"
        >
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="mt-auto flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:text-text"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-72 flex-none flex-col border-r border-border bg-panel">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-teal/40 bg-teal/10 text-teal-bright">
          <ShieldCheck size={17} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-text">CyfyClaw</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">
            Detection Engineering
          </div>
        </div>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={newConversation}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text transition-colors hover:border-teal"
        >
          <Plus size={15} className="text-teal-bright" />
          New Analysis
        </button>
      </div>

      <nav className="mt-4 min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <Section icon={<MessageSquare size={13} />} label="Previous Conversations">
          {conversations.length === 0 ? (
            <p className="px-1 text-xs text-muted/70">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectConversation(c.id)}
                className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                  c.id === activeId
                    ? "bg-panel-2 text-text"
                    : "text-muted hover:bg-panel-2 hover:text-text"
                }`}
                title={c.title}
              >
                {c.title}
              </button>
            ))
          )}
        </Section>

        <Section icon={<BookMarked size={13} />} label="Prompt Templates">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDraft(t.prompt)}
              className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-panel-2 hover:text-text"
              title={t.description}
            >
              {t.title}
            </button>
          ))}
        </Section>

        <Section icon={<Library size={13} />} label="Detection Library">
          {detections.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() =>
                setDraft(
                  `Analyze and tune this ${d.platform} rule (${d.name}):\n\n${d.query}`,
                )
              }
              className="block w-full truncate rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-panel-2 hover:text-text"
              title={d.description}
            >
              {d.name}
            </button>
          ))}
        </Section>
      </nav>

      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-muted transition-colors hover:text-text"
      >
        <ChevronLeft size={14} />
        Collapse sidebar
      </button>
    </aside>
  );
}

function Section({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-muted/80">
        {icon}
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
