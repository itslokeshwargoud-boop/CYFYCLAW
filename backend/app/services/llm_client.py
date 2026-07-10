"""OpenAI-compatible LLM provider(s) with streaming and reasoning suppression.

Talks to any OpenAI-compatible /chat/completions endpoint (default: the
Hugging Face Inference Providers router). Nothing here is hardcoded to a
specific model or vendor — every provider is constructed from configuration.

Two families of reasoning output are suppressed so the caller only ever
receives the final answer (the "internal reasoning, final answer only" design):

  * DeepSeek-R1 emits chain-of-thought either as a separate ``reasoning_content``
    delta field or inline inside ``<think>...</think>`` tags.
  * Kimi-K2.7-Code forces thinking and returns it in a separate ``reasoning`` /
    ``reasoning_content`` field.

Both mechanisms are handled: separate reasoning fields are ignored in
``_extract_content`` (only ``delta.content`` is read), and inline ``<think>``
spans are removed by :class:`ThinkStripper`.

Architecture
------------
:class:`BaseLLMProvider` holds all shared streaming logic. Concrete agents
(:class:`~app.services.providers.DeepSeekProvider`,
:class:`~app.services.providers.KimiProvider`) and the legacy
:class:`LLMClient` are thin subclasses that only supply configuration. This is
the single provider abstraction the whole platform reuses.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import httpx

from app.config import Settings

logger = logging.getLogger("cyfyclaw.llm")

_THINK_OPEN = "<think>"
_THINK_CLOSE = "</think>"


class LLMError(RuntimeError):
    """Raised when the upstream model provider cannot fulfill a request."""


class ThinkStripper:
    """Streaming state machine that removes <think>...</think> spans.

    Handles tags split across chunk boundaries by buffering only the small
    tail that could be the start of a partial tag.
    """

    def __init__(self) -> None:
        self._in_think = False
        self._buffer = ""

    def feed(self, text: str) -> str:
        """Consume a chunk; return the portion safe to emit to the user."""
        self._buffer += text
        out: list[str] = []

        while self._buffer:
            if self._in_think:
                idx = self._buffer.find(_THINK_CLOSE)
                if idx == -1:
                    # Keep only enough tail to detect a split closing tag.
                    self._buffer = self._buffer[-(len(_THINK_CLOSE) - 1):]
                    break
                self._buffer = self._buffer[idx + len(_THINK_CLOSE):]
                self._in_think = False
            else:
                idx = self._buffer.find(_THINK_OPEN)
                if idx == -1:
                    # Emit everything except a possible partial opening tag.
                    keep = len(_THINK_OPEN) - 1
                    if len(self._buffer) > keep:
                        out.append(self._buffer[:-keep] if keep else self._buffer)
                        self._buffer = self._buffer[-keep:] if keep else ""
                    break
                out.append(self._buffer[:idx])
                self._buffer = self._buffer[idx + len(_THINK_OPEN):]
                self._in_think = True

        return "".join(out)

    def flush(self) -> str:
        """Emit any remaining safe buffer at end of stream."""
        if self._in_think:
            return ""
        remaining, self._buffer = self._buffer, ""
        return remaining


class BaseLLMProvider:
    """Async client over an OpenAI-compatible chat completions endpoint.

    Concrete providers pass their own model id, base URL, label and generation
    controls. All streaming, reasoning suppression and error handling is shared
    here so every agent behaves identically on the wire.
    """

    #: Stable identifier for the agent (overridden by subclasses, e.g. "kimi").
    agent_key: str = "default"
    #: Which system-prompt persona this provider should run under.
    persona: str = "default"

    def __init__(
        self,
        *,
        token: str,
        model_id: str,
        base_url: str,
        temperature: float,
        max_tokens: int,
        timeout: float,
        label: str,
    ) -> None:
        self._token = token
        self._model_id = model_id
        self._base_url = base_url
        self._temperature = temperature
        self._max_tokens = max_tokens
        self._timeout = timeout
        self._label = label
        self._url = base_url.rstrip("/") + "/chat/completions"

    # ---- introspection ----
    @property
    def model_id(self) -> str:
        return self._model_id

    @property
    def label(self) -> str:
        return self._label

    @property
    def configured(self) -> bool:
        return bool(self._token) and bool(self._model_id) and bool(self._base_url)

    # ---- request construction ----
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    def _payload(
        self, messages: list[dict], *, stream: bool, temperature: float | None
    ) -> dict:
        return {
            "model": self._model_id,
            "messages": messages,
            "temperature": temperature if temperature is not None else self._temperature,
            "max_tokens": self._max_tokens,
            "stream": stream,
        }

    async def stream(
        self, messages: list[dict], *, temperature: float | None = None
    ) -> AsyncIterator[str]:
        """Yield visible answer tokens as they arrive (reasoning suppressed)."""
        if not self.configured:
            raise LLMError(
                f"{self._label} is not configured. Set HF_TOKEN and a valid "
                f"model id / base URL for this agent in the backend environment."
            )

        stripper = ThinkStripper()
        payload = self._payload(messages, stream=True, temperature=temperature)

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                async with client.stream(
                    "POST", self._url, headers=self._headers(), json=payload
                ) as resp:
                    if resp.status_code >= 400:
                        body = (await resp.aread()).decode("utf-8", "replace")
                        logger.error(
                            "[%s] upstream %s: %s",
                            self.agent_key,
                            resp.status_code,
                            body[:500],
                        )
                        raise LLMError(
                            _friendly_upstream_error(resp.status_code, body)
                        )

                    async for line in resp.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        data = line[len("data:"):].strip()
                        if data == "[DONE]":
                            break
                        piece = _extract_content(data)
                        if piece:
                            emit = stripper.feed(piece)
                            if emit:
                                yield emit

            tail = stripper.flush()
            if tail:
                yield tail

        except httpx.TimeoutException as exc:
            raise LLMError(
                "The model provider timed out. Try again or reduce input size."
            ) from exc
        except httpx.HTTPError as exc:
            raise LLMError(
                f"Network error contacting the model provider: {exc}"
            ) from exc


class LLMClient(BaseLLMProvider):
    """Backward-compatible single-agent client (legacy HF_MODEL_ID / LLM_BASE_URL).

    Preserved verbatim in behaviour so any existing caller of ``LLMClient(settings)``
    keeps working. New dual-agent code uses the providers in ``providers.py``.
    """

    agent_key = "legacy"

    def __init__(self, settings: Settings) -> None:
        super().__init__(
            token=settings.hf_token,
            model_id=settings.hf_model_id,
            base_url=settings.llm_base_url,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
            timeout=settings.llm_timeout_seconds,
            label="CyfyClaw",
        )


def _extract_content(data: str) -> str:
    """Pull visible delta text from an SSE chunk, ignoring reasoning fields."""
    try:
        obj = json.loads(data)
    except json.JSONDecodeError:
        return ""
    choices = obj.get("choices") or []
    if not choices:
        return ""
    delta = choices[0].get("delta") or {}
    # `reasoning_content` / `reasoning` (R1 & Kimi chain-of-thought on various
    # providers) are intentionally ignored — only the final answer is surfaced.
    return delta.get("content") or ""


def _friendly_upstream_error(status: int, body: str) -> str:
    if status in (401, 403):
        return (
            "Authentication failed. Check that HF_TOKEN is valid and has the "
            "'Inference Providers' scope."
        )
    if status == 404:
        return (
            "Model not found or not served by the selected provider. Verify the "
            "model id — a provider suffix such as ':novita', ':fireworks-ai' or "
            "':auto' is often required (e.g. moonshotai/Kimi-K2.7-Code:novita)."
        )
    if status == 429:
        return "Rate limited by the model provider. Please retry shortly."
    if status == 503:
        return (
            "The model provider is warming up or temporarily unavailable "
            "(HTTP 503). Retry shortly."
        )
    return f"Model provider returned HTTP {status}."
