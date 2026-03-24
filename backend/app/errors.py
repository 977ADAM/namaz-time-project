from typing import Any


class AppError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        status_code: int,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


class InvalidInputError(AppError):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code="INVALID_INPUT", message=message, status_code=400, details=details)


class NotFoundError(AppError):
    def __init__(self, message: str, *, code: str = "NOT_FOUND", details: dict[str, Any] | None = None) -> None:
        super().__init__(code=code, message=message, status_code=404, details=details)


class UpstreamTimeoutError(AppError):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code="UPSTREAM_TIMEOUT", message=message, status_code=504, details=details)


class UpstreamBadResponseError(AppError):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code="UPSTREAM_BAD_RESPONSE", message=message, status_code=502, details=details)


class UpstreamRateLimitedError(AppError):
    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(code="RATE_LIMITED", message=message, status_code=429, details=details)
