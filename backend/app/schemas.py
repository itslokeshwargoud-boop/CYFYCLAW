"""Pydantic request/response models — the API contract."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Role(str, Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class ChatMessage(BaseModel):
    role: Role
    content: str = Field(min_length=1, max_length=200_000)


class AnalyzeRequest(BaseModel):
    """A detection-engineering analysis request.

    `messages` carries the full conversation so the stateless backend has
    complete context. The latest user turn typically contains a rule to tune.
    """

    messages: list[ChatMessage] = Field(min_length=1)
    stream: bool = True
    # Optional override; falls back to configured default when omitted.
    temperature: float | None = Field(default=None, ge=0.0, le=2.0)

    def last_user_content(self) -> str:
        for msg in reversed(self.messages):
            if msg.role == Role.user:
                return msg.content
        return ""


class StreamDelta(BaseModel):
    """A single Server-Sent Event payload during streaming.

    `agent` identifies which agent the event belongs to ("kimi" or "deepseek").
    It is absent on the final overall "done" event.
    """

    type: Literal["meta", "token", "done", "error"]
    content: str = ""
    agent: str | None = None


class AgentInfo(BaseModel):
    """Configuration/readiness of a single detection agent."""

    key: str
    role: str
    model_id: str
    configured: bool


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    version: str
    # Legacy single-agent fields (retained for backward compatibility).
    model_configured: bool
    model_id: str
    # Dual-agent readiness.
    agents: list[AgentInfo] = []


class PromptTemplate(BaseModel):
    id: str
    title: str
    description: str
    prompt: str
    category: str


class DetectionRule(BaseModel):
    id: str
    name: str
    platform: str
    query: str
    mitre: list[str]
    description: str
