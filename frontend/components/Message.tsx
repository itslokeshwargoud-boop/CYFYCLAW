"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ShieldCheck, User } from "lucide-react";
import type { AgentKey, ChatMessage } from "@/lib/types";
import { AGENT_META, AGENT_ORDER } from "@/lib/types";
import Markdown from "./Markdown";
import CopyButton from "./CopyButton";

function AgentPanel({
  agent,
  message,
  streaming,
}: {
  agent: AgentKey;
  message: ChatMessage;
  streaming: boolean;
}) {
  const meta = AGENT_META[agent];
  const body = message.agents?.[agent] ?? "";
  const done = message.agentDone?.[agent] ?? false;
  const err = message.agentError?.[agent];
  const model = message.agentModel?.[agent] ?? meta.model;
  const active = streaming && !done && !err;
  const accent =
    agent === "kimi" ? "border-teal/40 bg-teal/5" : "border-amber/40 bg-amber/5";
  const badge =
    agent === "kimi"
      ? "border-teal/40 bg-teal/10 text-teal-bright"
      : "border-amber/40 bg-amber/10 text-amber";

  return (
    <div className={`min-w-0 rounded-xl border ${accent}`}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border ${badge}`}
          >
            <ShieldCheck size={13} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-text">
              {meta.role}
            </div>
            <div className="truncate font-mono text-[10px] text-muted">
              {model}
            </div>
          </div>
        </div>
        {body && !active ? (
          <div className="opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={body} />
          </div>
        ) : null}
      </div>

      <div className="px-3 py-3">
        {err ? (
          <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            <AlertTriangle size={15} className="mt-0.5 flex-none" />
            <span>{err}</span>
          </div>
        ) : (
          <div className="min-w-0">
            {body ? (
              <Markdown content={body} />
            ) : active ? (
              <div className="text-sm text-muted">Analyzing…</div>
            ) : null}
            {active ? (
              <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-0.5 animate-pulse bg-teal-bright" />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Message({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming?: boolean;
}) {
  const isUser = message.role === "user";
  const isDual = message.role === "assistant" && !!message.agents;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="group flex gap-3 px-4 py-5 md:px-8"
    >
      <div
        className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md border ${
          isUser
            ? "border-border bg-panel-2 text-muted"
            : "border-teal/40 bg-teal/10 text-teal-bright"
        }`}
      >
        {isUser ? <User size={15} /> : <ShieldCheck size={15} />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-muted">
            {isUser ? "You" : isDual ? "CyfyClaw · Dual-Agent Review" : "CyfyClaw"}
          </span>
          {!isUser && !isDual && message.content && !streaming ? (
            <div className="opacity-0 transition-opacity group-hover:opacity-100">
              <CopyButton text={message.content} />
            </div>
          ) : null}
        </div>

        {isUser ? (
          <div className="whitespace-pre-wrap break-words text-[0.925rem] leading-relaxed text-text">
            {message.content}
          </div>
        ) : isDual ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {AGENT_ORDER.map((agent) => (
              <AgentPanel
                key={agent}
                agent={agent}
                message={message}
                streaming={!!streaming}
              />
            ))}
          </div>
        ) : (
          <div className="min-w-0">
            <Markdown content={message.content} />
            {streaming ? (
              <span className="ml-0.5 inline-block h-4 w-[7px] translate-y-0.5 animate-pulse bg-teal-bright" />
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}
