"""Centralized exception handling for the API."""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.services.llm_client import LLMError

logger = logging.getLogger("cyfyclaw.errors")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(LLMError)
    async def _handle_llm_error(_: Request, exc: LLMError) -> JSONResponse:
        # 502: we are a gateway to the upstream model provider.
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected internal error occurred."},
        )
