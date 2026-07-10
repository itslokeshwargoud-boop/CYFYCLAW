import type { ChatMessage, DetectionRule, PromptTemplate, StreamEvent } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

/**
 * Stream a detection-engineering analysis from the backend.
 *
 * The backend emits Server-Sent Events of shape { type, content }. This parser
 * tolerates chunk boundaries that split individual SSE frames.
 *
 * @returns an async generator of StreamEvent objects.
 */
export async function* streamAnalyze(
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status}).`;
    try {
      const data = await res.json();
      if (data?.detail) detail = data.detail;
    } catch {
      /* non-JSON body — keep default */
    }
    yield { type: "error", content: detail };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice("data:".length).trim();
      if (!payload) continue;
      try {
        yield JSON.parse(payload) as StreamEvent;
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}

export async function fetchTemplates(): Promise<PromptTemplate[]> {
  const res = await fetch(`${API_BASE}/api/templates`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchDetections(): Promise<DetectionRule[]> {
  const res = await fetch(`${API_BASE}/api/detections`);
  if (!res.ok) return [];
  return res.json();
}
