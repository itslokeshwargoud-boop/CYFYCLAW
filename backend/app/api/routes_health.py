"""Health and readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app import __version__
from app.config import Settings, get_settings
from app.schemas import AgentInfo, HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
async def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Liveness + configuration readiness.

    Reports `degraded` (not failing) when no agent is configured so the UI can
    guide the operator without the container being marked unhealthy.
    """
    agents = [
        AgentInfo(
            key="kimi",
            role="Chief Detection Engineer",
            model_id=settings.kimi_model,
            configured=settings.kimi_configured,
        ),
        AgentInfo(
            key="deepseek",
            role="Principal Security Reviewer",
            model_id=settings.deepseek_model_id,
            configured=settings.deepseek_configured,
        ),
    ]
    return HealthResponse(
        status="ok" if settings.any_agent_configured else "degraded",
        version=__version__,
        model_configured=settings.llm_configured,
        model_id=settings.hf_model_id,
        agents=agents,
    )
