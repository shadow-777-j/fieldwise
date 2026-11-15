from datetime import datetime, timezone
from sqlalchemy import DateTime, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from app.database.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ObservationCache(Base):
    __tablename__ = "observation_cache"

    cache_key: Mapped[str] = mapped_column(String(256), primary_key=True)
    source_name: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

