from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from sqlalchemy.orm import Session
from app.config.settings import get_settings
from app.models.observation import ObservationCache


def get_cached_observation(db: Session, cache_key: str) -> Optional[dict[str, Any]]:
    record = db.get(ObservationCache, cache_key)
    if not record:
        return None
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        return None
    return record.payload_json


def set_cached_observation(
    db: Session,
    cache_key: str,
    source_name: str,
    payload: dict[str, Any],
    ttl_hours: Optional[int] = None,
) -> None:
    settings = get_settings()
    hours = ttl_hours if ttl_hours is not None else settings.observation_cache_ttl_hours
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=hours)
    existing = db.get(ObservationCache, cache_key)
    if existing:
        existing.source_name = source_name
        existing.payload_json = payload
        existing.fetched_at = now
        existing.expires_at = expires
    else:
        db.add(
            ObservationCache(
                cache_key=cache_key,
                source_name=source_name,
                payload_json=payload,
                fetched_at=now,
                expires_at=expires,
            )
        )
    db.commit()

