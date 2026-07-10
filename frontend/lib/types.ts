export type Role = "user" | "assistant" | "system";

/** The two independent detection agents. */
export type AgentKey = "kimi" | "deepseek";

export const AGENT_ORDER: AgentKey[] = ["kimi", "deepseek"];

export const AGENT_META: Record<
  AgentKey,
  { role: string; model: string }
> = {
  kimi: { role: "Chief Detection Engineer", model: "Kimi-K2.7-Code" },
  deepseek: { role: "Principal Security Reviewer", model: "DeepSeek-R1" },
};

export interface ChatMessage {
  role: Role;
  content: string;
  /** Per-agent streamed answer (present on dual-agent assistant turns). */
  agents?: Record<AgentKey, string>;
  /** Whether each agent has finished streaming. */
  agentDone?: Record<AgentKey, boolean>;
  /** User-safe error message per agent, if that agent failed. */
  agentError?: Partial<Record<AgentKey, string>>;
  /** Real (resolved) model id per agent, reported by the backend `meta` event. */
  agentModel?: Partial<Record<AgentKey, string>>;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  category: string;
}

export interface DetectionRule {
  id: string;
  name: string;
  platform: string;
  query: string;
  mitre: string[];
  description: string;
}

export interface StreamEvent {
  type: "meta" | "token" | "done" | "error";
  content: string;
  agent?: AgentKey;
}
