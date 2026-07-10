"""Application configuration.

All settings are loaded from environment variables (see `.env.example`).
Nothing is hardcoded — the model, provider base URL, and credentials are all
configurable so a different model can be substituted by editing config alone.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Typed application settings sourced from the environment."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- LLM / provider (shared credential + legacy single-agent defaults) ----
    # HF_TOKEN is shared by both agents (both are served via Hugging Face).
    hf_token: str = Field(default="", alias="HF_TOKEN")
    # Legacy single-agent settings. Retained for backward compatibility and used
    # as the fallback for the DeepSeek agent when DEEPSEEK_* is not set.
    hf_model_id: str = Field(default="deepseek-ai/DeepSeek-R1:auto", alias="HF_MODEL_ID")
    llm_base_url: str = Field(
        default="https://router.huggingface.co/v1", alias="LLM_BASE_URL"
    )
    llm_temperature: float = Field(default=0.2, alias="LLM_TEMPERATURE")
    llm_max_tokens: int = Field(default=4096, alias="LLM_MAX_TOKENS")
    # Accept either LLM_TIMEOUT_SECONDS (legacy) or LLM_TIMEOUT (new). Dual large
    # models can be slow, so the default is generous.
    llm_timeout_seconds: float = Field(
        default=300.0,
        validation_alias=AliasChoices("LLM_TIMEOUT_SECONDS", "LLM_TIMEOUT"),
    )

    # ---- Dual-agent providers (extend the single-agent config above) ----
    # Agent 1 — Chief Detection Engineer (Kimi-K2.7-Code).
    kimi_model: str = Field(
        default="moonshotai/Kimi-K2.7-Code:novita", alias="KIMI_MODEL"
    )
    kimi_base_url: str = Field(default="", alias="KIMI_BASE_URL")
    kimi_temperature: float | None = Field(default=None, alias="KIMI_TEMPERATURE")
    # Agent 2 — Principal Security Reviewer (DeepSeek-R1). Falls back to the
    # legacy HF_MODEL_ID / LLM_BASE_URL when DEEPSEEK_* is omitted.
    deepseek_model: str = Field(default="", alias="DEEPSEEK_MODEL")
    deepseek_base_url: str = Field(default="", alias="DEEPSEEK_BASE_URL")
    deepseek_temperature: float | None = Field(
        default=None, alias="DEEPSEEK_TEMPERATURE"
    )

    # ---- Server ----
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")

    @property
    def cors_origins(self) -> list[str]:
        """Parse FRONTEND_URL (comma-separated) into a list of origins."""
        return [o.strip() for o in self.frontend_url.split(",") if o.strip()]

    @property
    def llm_configured(self) -> bool:
        """True when the backend has enough config to reach the (legacy) model."""
        return bool(self.hf_token) and bool(self.hf_model_id) and bool(self.llm_base_url)

    # ---- Resolved per-agent configuration ----
    @property
    def deepseek_model_id(self) -> str:
        """DeepSeek model id, falling back to the legacy HF_MODEL_ID."""
        return self.deepseek_model or self.hf_model_id

    @property
    def deepseek_url(self) -> str:
        """DeepSeek base URL, falling back to the legacy LLM_BASE_URL."""
        return self.deepseek_base_url or self.llm_base_url

    @property
    def kimi_url(self) -> str:
        """Kimi base URL, falling back to the legacy LLM_BASE_URL."""
        return self.kimi_base_url or self.llm_base_url

    @property
    def deepseek_configured(self) -> bool:
        return (
            bool(self.hf_token)
            and bool(self.deepseek_model_id)
            and bool(self.deepseek_url)
        )

    @property
    def kimi_configured(self) -> bool:
        return (
            bool(self.hf_token) and bool(self.kimi_model) and bool(self.kimi_url)
        )

    @property
    def any_agent_configured(self) -> bool:
        return self.deepseek_configured or self.kimi_configured

    @field_validator("log_level")
    @classmethod
    def _normalize_log_level(cls, v: str) -> str:
        return v.upper()


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor (single instance per process)."""
    return Settings()
