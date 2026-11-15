from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VulnerabilityAnalysisRecord(Base):
    __tablename__ = "vulnerability_analyses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    farm_id: Mapped[str] = mapped_column(String(64), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    analysis_start_date: Mapped[str] = mapped_column(String(16), nullable=False)
    analysis_end_date: Mapped[str] = mapped_column(String(16), nullable=False)
    result_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    farm = relationship("Farm", back_populates="analyses")

