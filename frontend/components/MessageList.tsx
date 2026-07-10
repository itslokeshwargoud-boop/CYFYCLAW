"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";
import Message from "./Message";

export default function MessageList({
  messages,
  isStreaming,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest content as it streams.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStreaming]);

  return (
    <div className="mx-auto w-full max-w-6xl divide-y divide-border/60">
      {messages.map((m, i) => (
        <Message
          key={i}
          message={m}
          streaming={
            isStreaming && i === messages.length - 1 && m.role === "assistant"
          }
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
