"""Parallel multi-agent orchestration.

Launches every agent concurrently (true async fan-out) and multiplexes their
token streams into a single ordered event stream tagged by agent. Each agent is
fully isolated: one agent's failure never affects the other, and no agent ever
sees another agent's output.

Yielded events are ``(agent_key, event_type, content)`` where ``event_type`` is
one of ``"token"``, ``"done"`` or ``"error"``. A per-agent ``done`` is emitted
when that agent finishes cleanly; ``error`` carries a user-safe message.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator

from app.services.llm_client import BaseLLMProvider, LLMError

logger = logging.getLogger("cyfyclaw.orchestrator")

# Sentinel pushed by each worker when it has completely finished (success or
# failure). Used only for completion tracking; never forwarded to the client.
_END = "__end__"

# An agent job is (agent_key, provider, messages).
AgentJob = tuple[str, BaseLLMProvider, list[dict]]


async def _run_agent(
    agent_key: str,
    provider: BaseLLMProvider,
    messages: list[dict],
    queue: "asyncio.Queue[tuple[str, str, str]]",
) -> None:
    """Drive one provider's stream, pushing tagged events onto the queue."""
    try:
        async for token in provider.stream(messages):
            await queue.put((agent_key, "token", token))
        await queue.put((agent_key, "done", ""))
    except LLMError as exc:
        logger.warning("[%s] LLM error: %s", agent_key, exc)
        await queue.put((agent_key, "error", str(exc)))
    except asyncio.CancelledError:
        # Client disconnected / request aborted — exit quietly.
        raise
    except Exception:  # noqa: BLE001 - defensive: never leak internals to the client
        logger.exception("[%s] unexpected error", agent_key)
        await queue.put(
            (agent_key, "error", "An unexpected error occurred in this agent.")
        )
    finally:
        await queue.put((agent_key, _END, ""))


async def orchestrate(jobs: list[AgentJob]) -> AsyncIterator[tuple[str, str, str]]:
    """Run all agent jobs in parallel and yield their multiplexed events.

    Completes once every agent has emitted its terminal sentinel. If the
    consumer stops early (e.g. the HTTP client disconnects), all in-flight
    agent tasks are cancelled.
    """
    if not jobs:
        return

    queue: "asyncio.Queue[tuple[str, str, str]]" = asyncio.Queue()
    tasks = [
        asyncio.create_task(_run_agent(key, provider, messages, queue))
        for key, provider, messages in jobs
    ]
    remaining = len(tasks)

    try:
        while remaining > 0:
            agent_key, event_type, content = await queue.get()
            if event_type == _END:
                remaining -= 1
                continue
            yield agent_key, event_type, content
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
