"""Dual-agent detection-engineering analysis endpoint (SSE streaming).

The single /api/analyze endpoint now runs TWO independent agents concurrently
and streams their output as agent-tagged Server-Sent Events:

  - Agent 1 "kimi"     — Chief Detection Engineer   (Kimi-K2.7-Code)
  - Agent 2 "deepseek" — Principal Security Reviewer (DeepSeek-R1)

Event shape (JSON per SSE frame):
  {"type": "meta",  "agent": <k>, "content": <model_id>}   # once per agent, up-front
  {"type": "token", "agent": <k>, "content": <text>}       # streamed answer tokens
  {"type": "done",  "agent": <k>, "content": ""}           # that agent finished
  {"type": "error", "agent": <k>, "content": <message>}    # that agent failed
  {"type": "done",  "content": ""}                          # overall stream complete

The two agents never see each other's output; each receives only the shared
system prompt, its persona, and the user's turns.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.config import Settings, get_settings
from app.schemas import AnalyzeRequest
from app.services.orchestrator import AgentJob, orchestrate
from app.services.prompts import build_agent_messages
from app.services.providers import DeepSeekProvider, KimiProvider

logger = logging.getLogger("cyfyclaw.chat")
router = APIRouter(tags=["analysis"])


def _sse(event_type: str, content: str, agent: str | None = None) -> str:
    """Serialize a Server-Sent Event line, optionally tagged with an agent."""
    payload: dict[str, str] = {"type": event_type, "content": content}
    if agent is not None:
        payload["agent"] = agent
    return f"data: {json.dumps(payload)}\n\n"


async def _event_stream(
    settings: Settings, request: AnalyzeRequest
) -> AsyncIterator[str]:
    history = [m.model_dump(mode="json") for m in request.messages]

    kimi = KimiProvider(settings)
    deepseek = DeepSeekProvider(settings)

    jobs: list[AgentJob] = [
        ("kimi", kimi, build_agent_messages(history, persona=kimi.persona)),
        ("deepseek", deepseek, build_agent_messages(history, persona=deepseek.persona)),
    ]

    # Announce each agent's real (resolved) model id up-front so the UI can
    # label its panels accurately regardless of configuration.
    yield _sse("meta", kimi.model_id, agent="kimi")
    yield _sse("meta", deepseek.model_id, agent="deepseek")

    async for agent_key, event_type, content in orchestrate(jobs):
        yield _sse(event_type, content, agent=agent_key)

    # Overall completion signal (no agent tag).
    yield _sse("done", "")


@router.post("/analyze")
async def analyze(
    request: AnalyzeRequest, settings: Settings = Depends(get_settings)
) -> StreamingResponse:
    """Run a dual-agent detection-engineering analysis.

    Returns an SSE stream of agent-tagged `{type, content, agent?}` events. Both
    agents run in parallel; each produces its own complete, independent review.
    """
    return StreamingResponse(
        _event_stream(settings, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
