"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { useStore } from "@/lib/store";

const MAX_FILE_BYTES = 512 * 1024; // 512 KB guard for pasted/dropped text files
const TEXT_EXT = /\.(txt|log|json|ya?ml|sigma|conf|csv|md|rule|ndjson)$/i;

export default function PromptBox() {
  const [dragging, setDragging] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const value = useStore((s) => s.draft);
  const setValue = useStore((s) => s.setDraft);
  const isStreaming = useStore((s) => s.isStreaming);
  const send = useStore((s) => s.send);
  const stop = useStore((s) => s.stop);

  const autosize = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 260) + "px";
  }, []);

  // Re-measure when the draft changes (e.g. a suggested prompt is inserted).
  useEffect(() => {
    autosize();
  }, [value, autosize]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    autosize();
  }

  function submit() {
    if (isStreaming) return;
    const text = value.trim();
    if (!text) return;
    void send(text);
    setValue("");
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  async function ingestFiles(files: FileList | File[]) {
    const parts: string[] = [];
    for (const file of Array.from(files)) {
      if (!TEXT_EXT.test(file.name) && !file.type.startsWith("text")) {
        parts.push(`\n[Skipped ${file.name}: unsupported binary type]`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        parts.push(`\n[Skipped ${file.name}: exceeds 512 KB]`);
        continue;
      }
      const text = await file.text();
      parts.push(`\n\n--- ${file.name} ---\n${text}`);
    }
    if (parts.length) {
      const current = useStore.getState().draft;
      setValue((current + parts.join("")).trimStart());
      requestAnimationFrame(autosize);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void ingestFiles(e.dataTransfer.files);
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) await ingestFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 md:px-0">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border bg-panel transition-colors ${
          dragging ? "border-teal-bright" : "border-border"
        }`}
      >
        {dragging ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-teal/10 text-sm text-teal-bright">
            Drop rules, logs, JSON, or YAML to attach
          </div>
        ) : null}

        <textarea
          ref={taRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Paste a Datadog rule, Sigma rule, OCSF query, or logs…"
          className="max-h-[260px] w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-[0.925rem] leading-relaxed text-text outline-none placeholder:text-muted/70"
        />

        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-text">
            <Paperclip size={14} />
            <span className="hidden sm:inline">Attach</span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={onPickFiles}
              accept=".txt,.log,.json,.yaml,.yml,.sigma,.conf,.csv,.md,.rule,.ndjson,text/*"
            />
          </label>

          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] text-muted/70 sm:inline">
              Enter to send · Shift+Enter for newline
            </span>
            {isStreaming ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel-2 text-text transition-colors hover:border-danger hover:text-danger"
                aria-label="Stop generating"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={!value.trim()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-teal text-white transition-opacity hover:bg-teal-bright disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted/60">
        CyfyClaw prioritizes detection coverage over alert reduction. Verify every
        tuned rule before deploying to production.
      </p>
    </div>
  );
}
