from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DecisionReportRecord(Base):
    __tablename__ = "decision_reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    farm_id: Mapped[str] = mapped_column(String(64), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    farm = relationship("Farm", back_populates="reports")

