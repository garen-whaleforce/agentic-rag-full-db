from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis  # type: ignore[import]
except Exception:  # redis 未安裝或初始化失敗時
    redis = None  # type: ignore[assignment]

_redis_client: Optional["redis.Redis"] = None  # type: ignore[name-defined]


def _get_connection_url() -> Optional[str]:
    """
    優先使用 REDIS_URL，其次 REDIS_CONNECTION_STRING。
    如果都沒有，回傳 None，表示不啟用 Redis。
    """
    return os.getenv("REDIS_URL") or os.getenv("REDIS_CONNECTION_STRING")


def get_redis_client() -> Optional["redis.Redis"]:  # type: ignore[name-defined]
    """
    取得全域共用的 async Redis client.

    - 若 redis 套件沒裝或 URL 未設定，回傳 None。
    - 若初始化失敗，寫 log 並回傳 None。
    """
    global _redis_client

    if redis is None:  # type: ignore[truthy-function]
        logger.info("redis library is not available; Redis cache disabled")
        return None

    if _redis_client is not None:
        return _redis_client

    url = _get_connection_url()
    if not url:
        logger.info("REDIS_URL/REDIS_CONNECTION_STRING not set; Redis cache disabled")
        return None

    try:
        _redis_client = redis.from_url(  # type: ignore[assignment]
            url,
            encoding="utf-8",
            decode_responses=True,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to initialize Redis client: %s", exc)
        _redis_client = None

    return _redis_client


async def cache_get_json(key: str) -> Optional[Any]:
    """
    從 Redis 取出 JSON 字串並反序列化。

    - 若 Redis 未啟用或發生錯誤，回傳 None。
    """
    client = get_redis_client()
    if client is None:
        return None

    try:
        raw = await client.get(key)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis GET failed for key %s: %s", key, exc)
        return None

    if raw is None:
        return None

    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        logger.warning("Failed to decode Redis JSON for key %s", key)
        return None


async def cache_set_json(key: str, value: Any, ttl_seconds: int) -> None:
    """
    將 Python 物件序列化成 JSON 存入 Redis，並設定 TTL。

    - 若 Redis 未啟用或發生錯誤，不要拋出例外，只寫 log。
    """
    client = get_redis_client()
    if client is None:
        return

    try:
        payload = json.dumps(value or {})
        await client.setex(key, ttl_seconds, payload)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis SETEX failed for key %s: %s", key, exc)
