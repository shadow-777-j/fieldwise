from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Farm(Base):
    __tablename__ = "farms"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    region: Mapped[str] = mapped_column(String(200), nullable=False)
    farming_system: Mapped[str] = mapped_column(String(64), nullable=False, default="conventional_rice_pulse")
    geometry_geojson: Mapped[dict] = mapped_column(JSON, nullable=False)
    geometry_wkt: Mapped[str] = mapped_column(Text, nullable=False)
    centroid_lat: Mapped[float] = mapped_column(Float, nullable=False)
    centroid_lon: Mapped[float] = mapped_column(Float, nullable=False)
    area_hectares: Mapped[float] = mapped_column(Float, nullable=False)
    perimeter_meters: Mapped[float] = mapped_column(Float, nullable=False)
    elevation_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    analysis_start_date: Mapped[str] = mapped_column(String(16), nullable=False, default="2018-01-01")
    analysis_end_date: Mapped[str] = mapped_column(String(16), nullable=False, default="2026-10-31")
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    data_origin: Mapped[str] = mapped_column(String(32), nullable=False, default="user_entered")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    soil_profile = relationship("SoilProfile", back_populates="farm", uselist=False, cascade="all, delete-orphan")
    analyses = relationship("VulnerabilityAnalysisRecord", back_populates="farm", cascade="all, delete-orphan")
    reports = relationship("DecisionReportRecord", back_populates="farm", cascade="all, delete-orphan")

