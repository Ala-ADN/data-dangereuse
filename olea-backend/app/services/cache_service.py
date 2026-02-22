"""
Redis prediction cache — SHA-256 deterministic hashing.

How it works:
  1. Sort the 28 incoming features deterministically
  2. SHA-256 hash the canonical JSON string
  3. If Redis has the hash → return cached prediction in <5 ms
  4. If miss → run XGBoost, store result with configurable TTL

This eliminates redundant ML inference for identical feature profiles.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)

_pool: redis.Redis | None = None

CACHE_PREFIX = "certus:pred:"
DEFAULT_TTL = 60 * 60 * 24  # 24 hours


async def init_cache() -> None:
    """Initialize the async Redis connection pool."""
    global _pool
    if _pool is not None:
        return
    try:
        _pool = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
        )
        await _pool.ping()
        logger.info("✅ Redis cache connected — %s", settings.REDIS_URL)
    except Exception as e:
        logger.warning("⚠️  Redis unavailable, caching disabled: %s", e)
        _pool = None


async def close_cache() -> None:
    """Gracefully close the Redis connection pool."""
    global _pool
    if _pool:
        await _pool.aclose()
        _pool = None
        logger.info("Redis cache connection closed")


def _hash_features(features: dict[str, Any]) -> str:
    """
    Generate a deterministic SHA-256 hash for a feature dict.

    Keys are sorted, values are rounded (floats to 6 dp) to avoid
    floating-point noise producing different hashes.
    """
    # Strip keys that don't affect prediction (IDs, metadata)
    skip = {"User_ID", "Employer_ID"}
    canonical = {}
    for k in sorted(features.keys()):
        if k in skip:
            continue
        v = features[k]
        if isinstance(v, float):
            v = round(v, 6)
        canonical[k] = v

    payload = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


async def get_cached_prediction(features: dict[str, Any]) -> dict | None:
    """Look up a cached prediction by feature hash. Returns None on miss."""
    if _pool is None:
        return None
    try:
        key = CACHE_PREFIX + _hash_features(features)
        raw = await _pool.get(key)
        if raw:
            logger.info("🎯 Cache HIT — %s", key[:24])
            result = json.loads(raw)
            result["cached"] = True
            return result
    except Exception as e:
        logger.warning("Cache read error: %s", e)
    return None


async def set_cached_prediction(
    features: dict[str, Any],
    prediction: dict[str, Any],
    ttl: int = DEFAULT_TTL,
) -> None:
    """Store a prediction result in Redis with the given TTL."""
    if _pool is None:
        return
    try:
        key = CACHE_PREFIX + _hash_features(features)
        await _pool.set(key, json.dumps(prediction), ex=ttl)
        logger.debug("💾 Cache SET — %s (TTL %ds)", key[:24], ttl)
    except Exception as e:
        logger.warning("Cache write error: %s", e)


async def invalidate_cache() -> None:
    """Flush all prediction cache entries (e.g. after model update)."""
    if _pool is None:
        return
    try:
        cursor = "0"
        while cursor:
            cursor, keys = await _pool.scan(cursor=cursor, match=f"{CACHE_PREFIX}*", count=100)
            if keys:
                await _pool.delete(*keys)
        logger.info("🗑️  Prediction cache invalidated")
    except Exception as e:
        logger.warning("Cache invalidation error: %s", e)


async def get_cache_stats() -> dict:
    """Return cache health stats for the /health endpoint."""
    if _pool is None:
        return {"status": "disabled", "reason": "Redis not connected"}
    try:
        info = await _pool.info("stats")
        db_info = await _pool.info("keyspace")
        return {
            "status": "connected",
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "keys": sum(v.get("keys", 0) for v in db_info.values() if isinstance(v, dict)),
        }
    except Exception as e:
        return {"status": "error", "reason": str(e)}
