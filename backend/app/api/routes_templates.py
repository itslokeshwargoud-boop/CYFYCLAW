"""Prompt templates and detection library endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas import DetectionRule, PromptTemplate
from app.services.detection_library import DETECTION_LIBRARY, PROMPT_TEMPLATES

router = APIRouter(tags=["library"])


@router.get("/templates", response_model=list[PromptTemplate])
async def list_templates() -> list[PromptTemplate]:
    return PROMPT_TEMPLATES


@router.get("/detections", response_model=list[DetectionRule])
async def list_detections() -> list[DetectionRule]:
    return DETECTION_LIBRARY
