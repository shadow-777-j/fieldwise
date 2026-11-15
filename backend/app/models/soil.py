from datetime import datetime, timezone
from sqlalchemy import DateTime, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.session import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SoilProfile(Base):
    __tablename__ = "soil_profiles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    farm_id: Mapped[str] = mapped_column(String(64), ForeignKey("farms.id", ondelete="CASCADE"), unique=True, nullable=False)

    # Farmer-entered or laboratory-derived chemical/physical metrics (nullable for unknown)
    ph: Mapped[float | None] = mapped_column(Float, nullable=True)
    ec_ds_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    organic_carbon_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    nitrogen_kg_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    phosphorus_kg_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    potassium_kg_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    soil_texture: Mapped[str | None] = mapped_column(String(64), nullable=True)
    field_soil_moisture_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    salinity_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    irrigation_availability: Mapped[str | None] = mapped_column(String(64), nullable=True)
    drainage_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    waterlogging_history: Mapped[str | None] = mapped_column(String(64), nullable=True)

    farmer_constraints: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    crop_history: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    data_origin: Mapped[str] = mapped_column(String(32), nullable=False, default="user_entered")
    lab_sample_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    farm = relationship("Farm", back_populates="soil_profile")

