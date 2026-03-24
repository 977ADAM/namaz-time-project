import os
from dataclasses import dataclass
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, Field, ValidationError, field_validator

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except ImportError:  # pragma: no cover - optional dependency in local env
    BaseSettings = None
    SettingsConfigDict = None


class _SettingsSchema(BaseModel):
    app_name: str = "Namaz Time API"
    app_version: str = "0.2.0"
    environment: Literal["development", "stage", "production"] = "development"
    debug: bool = False
    log_level: Literal["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"] = "INFO"
    prayer_api_base_url: AnyHttpUrl = "https://api.aladhan.com/v1/timings"
    prayer_api_timeout_seconds: int = Field(default=15, ge=1, le=120)
    cache_ttl_seconds: int = Field(default=300, ge=0, le=86400)
    rate_limit_enabled: bool = True
    rate_limit_requests: int = Field(default=120, ge=1, le=10000)
    rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)
    security_headers_enabled: bool = True
    metrics_enabled: bool = False
    cors_allow_origins: list[str] = Field(default_factory=lambda: ["*"])

    @field_validator("log_level", mode="before")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        return str(value).upper()

    @field_validator("cors_allow_origins", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: object) -> list[str]:
        if value is None:
            return ["*"]
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()] or ["*"]
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()] or ["*"]
        raise ValueError("cors_allow_origins must be a comma-separated string or a list")


if BaseSettings is not None:

    class _SettingsSource(_SettingsSchema, BaseSettings):
        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            case_sensitive=False,
            extra="ignore",
            populate_by_name=True,
        )

        app_name: str = Field(default="Namaz Time API", alias="APP_NAME")
        app_version: str = Field(default="0.2.0", alias="APP_VERSION")
        environment: Literal["development", "stage", "production"] = Field(
            default="development", alias="APP_ENV"
        )
        debug: bool = Field(default=False, alias="APP_DEBUG")
        log_level: Literal["CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"] = Field(
            default="INFO", alias="LOG_LEVEL"
        )
        prayer_api_base_url: AnyHttpUrl = Field(
            default="https://api.aladhan.com/v1/timings", alias="PRAYER_API_BASE_URL"
        )
        prayer_api_timeout_seconds: int = Field(default=15, alias="PRAYER_API_TIMEOUT_SECONDS", ge=1, le=120)
        cache_ttl_seconds: int = Field(default=300, alias="CACHE_TTL_SECONDS", ge=0, le=86400)
        rate_limit_enabled: bool = Field(default=True, alias="RATE_LIMIT_ENABLED")
        rate_limit_requests: int = Field(default=120, alias="RATE_LIMIT_REQUESTS", ge=1, le=10000)
        rate_limit_window_seconds: int = Field(default=60, alias="RATE_LIMIT_WINDOW_SECONDS", ge=1, le=3600)
        security_headers_enabled: bool = Field(default=True, alias="SECURITY_HEADERS_ENABLED")
        metrics_enabled: bool = Field(default=False, alias="METRICS_ENABLED")
        cors_allow_origins: list[str] = Field(default_factory=lambda: ["*"], alias="CORS_ALLOW_ORIGINS")


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    environment: str
    debug: bool
    log_level: str
    prayer_api_base_url: str
    prayer_api_timeout_seconds: int
    cache_ttl_seconds: int
    rate_limit_enabled: bool
    rate_limit_requests: int
    rate_limit_window_seconds: int
    security_headers_enabled: bool
    metrics_enabled: bool
    cors_allow_origins: list[str]


def _load_raw_settings() -> dict[str, object]:
    return {
        "app_name": os.getenv("APP_NAME", "Namaz Time API"),
        "app_version": os.getenv("APP_VERSION", "0.2.0"),
        "environment": os.getenv("APP_ENV", "development"),
        "debug": os.getenv("APP_DEBUG", "false"),
        "log_level": os.getenv("LOG_LEVEL", "INFO"),
        "prayer_api_base_url": os.getenv("PRAYER_API_BASE_URL", "https://api.aladhan.com/v1/timings"),
        "prayer_api_timeout_seconds": os.getenv("PRAYER_API_TIMEOUT_SECONDS", 15),
        "cache_ttl_seconds": os.getenv("CACHE_TTL_SECONDS", 300),
        "rate_limit_enabled": os.getenv("RATE_LIMIT_ENABLED", "true"),
        "rate_limit_requests": os.getenv("RATE_LIMIT_REQUESTS", 120),
        "rate_limit_window_seconds": os.getenv("RATE_LIMIT_WINDOW_SECONDS", 60),
        "security_headers_enabled": os.getenv("SECURITY_HEADERS_ENABLED", "true"),
        "metrics_enabled": os.getenv("METRICS_ENABLED", "false"),
        "cors_allow_origins": os.getenv("CORS_ALLOW_ORIGINS", "*"),
    }


def _load_settings() -> Settings:
    try:
        if BaseSettings is not None:
            validated = _SettingsSource()
        else:
            validated = _SettingsSchema.model_validate(_load_raw_settings())
    except ValidationError as exc:  # pragma: no cover - startup validation
        raise RuntimeError(f"Invalid application settings: {exc}") from exc

    payload = validated.model_dump()
    payload["prayer_api_base_url"] = str(payload["prayer_api_base_url"])
    return Settings(**payload)


settings = _load_settings()
