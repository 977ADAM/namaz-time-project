from collections import deque
from dataclasses import dataclass
from time import monotonic


@dataclass
class RateLimitResult:
    allowed: bool
    remaining: int
    reset_after_seconds: int


class InMemoryRateLimiter:
    def __init__(self, *, requests: int, window_seconds: int) -> None:
        self.requests = requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, deque[float]] = {}
        self._blocked_requests = 0
        self._allowed_requests = 0

    def check(self, key: str) -> RateLimitResult:
        now = monotonic()
        bucket = self._buckets.setdefault(key, deque())
        window_start = now - self.window_seconds

        while bucket and bucket[0] <= window_start:
            bucket.popleft()

        if len(bucket) >= self.requests:
            reset_after_seconds = max(1, int(self.window_seconds - (now - bucket[0])))
            self._blocked_requests += 1
            return RateLimitResult(allowed=False, remaining=0, reset_after_seconds=reset_after_seconds)

        bucket.append(now)
        remaining = max(0, self.requests - len(bucket))
        self._allowed_requests += 1
        return RateLimitResult(allowed=True, remaining=remaining, reset_after_seconds=self.window_seconds)

    def get_stats(self) -> dict[str, int]:
        return {
            "requests": self.requests,
            "window_seconds": self.window_seconds,
            "active_buckets": len(self._buckets),
            "allowed_requests": self._allowed_requests,
            "blocked_requests": self._blocked_requests,
        }
