"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";

function languageFromClass(className?: string): string {
  const match = /language-([\w-]+)/.exec(className ?? "");
  return match ? match[1] : "";
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  // Derive the language label from the nested <code> element's className.
  let lang = "";
  const child: any = Array.isArray(children) ? children[0] : children;
  if (child?.props?.className) lang = languageFromClass(child.props.className);

  async function copy() {
    const value = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-[#0b1116]">
      <div className="flex items-center justify-between border-b border-border bg-panel-2 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted">
          {lang || "text"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-text"
          aria-label="Copy code"
        >
          {copied ? (
            <Check size={12} className="text-success" />
          ) : (
            <Copy size={12} />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre ref={preRef} className="overflow-x-auto p-3 text-[0.82rem] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="cc-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          code: ({ className, children, ...props }) => {
            // Inline code has no language className; block code is handled by <pre>.
            if (!className) {
              return (
                <code {...props}>{children}</code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
