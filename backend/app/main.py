"""CyfyClaw API application factory."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import routes_chat, routes_health, routes_templates
from app.config import get_settings
from app.core.errors import register_exception_handlers
from app.logging_config import configure_logging


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    logger = logging.getLogger("cyfyclaw")

    app = FastAPI(
        title="CyfyClaw API",
        version=__version__,
        description="AI Detection Engineering Platform for Enterprise SOCs.",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    app.include_router(routes_health.router)
    app.include_router(routes_templates.router, prefix="/api")
    app.include_router(routes_chat.router, prefix="/api")

    if not settings.any_agent_configured:
        logger.warning(
            "No detection agent is configured (missing HF_TOKEN and/or model ids). "
            "The API will start but /api/analyze will return per-agent configuration errors."
        )
    else:
        logger.info(
            "Agent 1 (Chief Detection Engineer / Kimi): %s [%s] via %s",
            settings.kimi_model,
            "configured" if settings.kimi_configured else "NOT configured",
            settings.kimi_url,
        )
        logger.info(
            "Agent 2 (Principal Security Reviewer / DeepSeek): %s [%s] via %s",
            settings.deepseek_model_id,
            "configured" if settings.deepseek_configured else "NOT configured",
            settings.deepseek_url,
        )

    return app


app = create_app()
