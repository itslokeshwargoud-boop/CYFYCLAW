"use client";

import { create } from "zustand";
import type { AgentKey, ChatMessage, Conversation } from "./types";
import { AGENT_ORDER } from "./types";
import { streamAnalyze } from "./api";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? t.slice(0, 42) + "…" : t || "New analysis";
}

function emptyAgents<T>(value: T): Record<AgentKey, T> {
  return AGENT_ORDER.reduce(
    (acc, k) => ({ ...acc, [k]: value }),
    {} as Record<AgentKey, T>,
  );
}

interface AppState {
  conversations: Conversation[];
  activeId: string | null;
  isStreaming: boolean;
  error: string | null;
  draft: string;

  activeConversation: () => Conversation | null;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  setDraft: (v: string) => void;
  send: (content: string) => Promise<void>;
  stop: () => void;
}

let abortController: AbortController | null = null;

export const useStore = create<AppState>((set, get) => ({
  conversations: [],
  activeId: null,
  isStreaming: false,
  error: null,
  draft: "",

  activeConversation: () => {
    const { conversations, activeId } = get();
    return conversations.find((c) => c.id === activeId) ?? null;
  },

  setDraft: (v) => set({ draft: v }),

  newConversation: () => {
    if (get().isStreaming) return;
    set({ activeId: null, error: null, draft: "" });
  },

  selectConversation: (id) => {
    if (get().isStreaming) return;
    set({ activeId: id, error: null });
  },

  stop: () => {
    abortController?.abort();
    abortController = null;
    set({ isStreaming: false });
  },

  send: async (content) => {
    const text = content.trim();
    if (!text || get().isStreaming) return;

    let convo = get().activeConversation();

    // Create a conversation on first message.
    if (!convo) {
      convo = {
        id: uid(),
        title: titleFrom(text),
        messages: [],
        createdAt: Date.now(),
      };
      set((s) => ({
        conversations: [convo!, ...s.conversations],
        activeId: convo!.id,
      }));
    }

    const convoId = convo.id;
    const userMsg: ChatMessage = { role: "user", content: text };
    // Dual-agent assistant turn: each agent streams into its own bucket.
    const assistantMsg: ChatMessage = {
      role: "assistant",
      content: "",
      agents: emptyAgents(""),
      agentDone: emptyAgents(false),
      agentError: {},
      agentModel: {},
    };

    // Optimistically append user + empty assistant message; clear the draft.
    set((s) => ({
      error: null,
      isStreaming: true,
      draft: "",
      conversations: s.conversations.map((c) =>
        c.id === convoId
          ? { ...c, messages: [...c.messages, userMsg, assistantMsg] }
          : c,
      ),
    }));

    // Each agent receives ONLY the user-authored turns (which carry the rule
    // and any follow-up instructions) — never any assistant output.
    const history: ChatMessage[] = (
      get().conversations.find((c) => c.id === convoId)?.messages ?? []
    )
      .filter((m) => m.role === "user")
      .map((m) => ({ role: m.role, content: m.content }));

    abortController = new AbortController();

    // Mutate the trailing assistant message of this conversation.
    const patchAssistant = (fn: (m: ChatMessage) => ChatMessage) => {
      set((s) => ({
        conversations: s.conversations.map((c) => {
          if (c.id !== convoId) return c;
          const msgs = [...c.messages];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") msgs[msgs.length - 1] = fn(last);
          return { ...c, messages: msgs };
        }),
      }));
    };

    const appendAgent = (agent: AgentKey, chunk: string) =>
      patchAssistant((m) => ({
        ...m,
        agents: { ...(m.agents ?? emptyAgents("")), [agent]: (m.agents?.[agent] ?? "") + chunk },
      }));

    const markAgentDone = (agent: AgentKey) =>
      patchAssistant((m) => ({
        ...m,
        agentDone: { ...(m.agentDone ?? emptyAgents(false)), [agent]: true },
      }));

    const setAgentError = (agent: AgentKey, msg: string) =>
      patchAssistant((m) => ({
        ...m,
        agentError: { ...(m.agentError ?? {}), [agent]: msg },
        agentDone: { ...(m.agentDone ?? emptyAgents(false)), [agent]: true },
      }));

    const setAgentModel = (agent: AgentKey, model: string) =>
      patchAssistant((m) => ({
        ...m,
        agentModel: { ...(m.agentModel ?? {}), [agent]: model },
      }));

    try {
      for await (const evt of streamAnalyze(history, abortController.signal)) {
        if (evt.type === "meta" && evt.agent) setAgentModel(evt.agent, evt.content);
        else if (evt.type === "token" && evt.agent) appendAgent(evt.agent, evt.content);
        else if (evt.type === "done" && evt.agent) markAgentDone(evt.agent);
        else if (evt.type === "error" && evt.agent) setAgentError(evt.agent, evt.content);
        else if (evt.type === "error") set({ error: evt.content });
        else if (evt.type === "done") break; // overall completion
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        set({ error: (err as Error).message || "Streaming failed." });
      }
    } finally {
      abortController = null;
      // Ensure any agent still marked in-flight stops showing a cursor.
      patchAssistant((m) => ({
        ...m,
        agentDone: AGENT_ORDER.reduce(
          (acc, k) => ({ ...acc, [k]: m.agentDone?.[k] ?? true }),
          {} as Record<AgentKey, boolean>,
        ),
      }));
      set({ isStreaming: false });
    }
  },
}));
