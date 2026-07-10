"""Concrete dual-agent LLM providers.

Both agents are thin subclasses of :class:`~app.services.llm_client.BaseLLMProvider`
and expose an identical interface (``.stream()``, ``.model_id``, ``.label``,
``.configured``). They differ only in configuration and persona, so additional
models can be added later by writing another small subclass — no changes to the
streaming, error-handling or orchestration code are required.

Agent 1 — Chief Detection Engineer   → Kimi-K2.7-Code
Agent 2 — Principal Security Reviewer → DeepSeek-R1
"""

from __future__ import annotations

from app.config import Settings
from app.services.llm_client import BaseLLMProvider


class KimiProvider(BaseLLMProvider):
    """Agent 1 — Chief Detection Engineer (moonshotai/Kimi-K2.7-Code)."""

    agent_key = "kimi"
    persona = "chief_engineer"

    def __init__(self, settings: Settings) -> None:
        super().__init__(
            token=settings.hf_token,
            model_id=settings.kimi_model,
            base_url=settings.kimi_url,
            temperature=(
                settings.kimi_temperature
                if settings.kimi_temperature is not None
                else settings.llm_temperature
            ),
            max_tokens=settings.llm_max_tokens,
            timeout=settings.llm_timeout_seconds,
            label="Chief Detection Engineer",
        )


class DeepSeekProvider(BaseLLMProvider):
    """Agent 2 — Principal Security Reviewer (deepseek-ai/DeepSeek-R1)."""

    agent_key = "deepseek"
    persona = "principal_reviewer"

    def __init__(self, settings: Settings) -> None:
        super().__init__(
            token=settings.hf_token,
            model_id=settings.deepseek_model_id,
            base_url=settings.deepseek_url,
            temperature=(
                settings.deepseek_temperature
                if settings.deepseek_temperature is not None
                else settings.llm_temperature
            ),
            max_tokens=settings.llm_max_tokens,
            timeout=settings.llm_timeout_seconds,
            label="Principal Security Reviewer",
        )
