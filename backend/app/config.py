import os
from dataclasses import dataclass


def _get_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _get_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    return int(raw)


def _get_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Namaz Time API")
    app_version: str = os.getenv("APP_VERSION", "0.2.0")
    environment: str = os.getenv("APP_ENV", "development")
    debug: bool = _get_bool("APP_DEBUG", False)
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()
    prayer_api_base_url: str = os.getenv("PRAYER_API_BASE_URL", "https://api.aladhan.com/v1/timings")
    prayer_api_timeout_seconds: int = _get_int("PRAYER_API_TIMEOUT_SECONDS", 15)
    cache_ttl_seconds: int = _get_int("CACHE_TTL_SECONDS", 300)
    rate_limit_enabled: bool = _get_bool("RATE_LIMIT_ENABLED", True)
    rate_limit_requests: int = _get_int("RATE_LIMIT_REQUESTS", 120)
    rate_limit_window_seconds: int = _get_int("RATE_LIMIT_WINDOW_SECONDS", 60)
    security_headers_enabled: bool = _get_bool("SECURITY_HEADERS_ENABLED", True)
    metrics_enabled: bool = _get_bool("METRICS_ENABLED", False)
    cors_allow_origins: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.cors_allow_origins is None:
            object.__setattr__(self, "cors_allow_origins", _get_list("CORS_ALLOW_ORIGINS", ["*"]))


settings = Settings()
