"use client";

import { AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import MessageList from "./MessageList";
import PromptBox from "./PromptBox";
import SuggestedPrompts from "./SuggestedPrompts";

export default function ChatWorkspace() {
  const activeConversation = useStore((s) => s.activeConversation());
  const isStreaming = useStore((s) => s.isStreaming);
  const error = useStore((s) => s.error);

  const hasMessages = !!activeConversation && activeConversation.messages.length > 0;

  return (
    <section className="flex h-full flex-1 flex-col overflow-hidden bg-bg">
      <header className="flex h-12 flex-none items-center justify-between border-b border-border px-4 md:px-8">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-tight text-text">
            CyfyClaw
          </span>
          <span className="hidden text-xs text-muted sm:inline">
            AI Detection Engineering Platform
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {hasMessages ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MessageList
              messages={activeConversation!.messages}
              isStreaming={isStreaming}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <SuggestedPrompts />
          </div>
        )}

        {error ? (
          <div className="mx-auto w-full max-w-3xl px-4 md:px-0">
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle size={15} className="mt-0.5 flex-none" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        <div className="flex-none pt-2">
          <PromptBox />
        </div>
      </div>
    </section>
  );
}
