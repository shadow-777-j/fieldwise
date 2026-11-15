from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FarmCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=160)
    region: str = Field(..., min_length=2, max_length=200)
    farming_system: str = Field(default="conventional_rice_pulse")
    geometry_geojson: Dict[str, Any]
    analysis_start_date: str = Field(default="2018-01-01")
    analysis_end_date: str = Field(default="2026-10-31")
    notes: Optional[str] = None


class FarmUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=160)
    region: Optional[str] = Field(default=None, min_length=2, max_length=200)
    farming_system: Optional[str] = None
    geometry_geojson: Optional[Dict[str, Any]] = None
    analysis_start_date: Optional[str] = None
    analysis_end_date: Optional[str] = None
    notes: Optional[str] = None


class SoilProfileInput(BaseModel):
    ph: Optional[float] = Field(default=None, ge=2.0, le=11.0)
    ec_ds_m: Optional[float] = Field(default=None, ge=0.0, le=60.0)
    organic_carbon_pct: Optional[float] = Field(default=None, ge=0.0, le=30.0)
    nitrogen_kg_ha: Optional[float] = Field(default=None, ge=0.0, le=2000.0)
    phosphorus_kg_ha: Optional[float] = Field(default=None, ge=0.0, le=1000.0)
    potassium_kg_ha: Optional[float] = Field(default=None, ge=0.0, le=2000.0)
    soil_texture: Optional[str] = None
    field_soil_moisture_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    salinity_class: Optional[str] = None
    irrigation_availability: Optional[str] = None
    drainage_class: Optional[str] = None
    waterlogging_history: Optional[str] = None
    farmer_constraints: Dict[str, Any] = Field(default_factory=dict)
    crop_history: List[Dict[str, Any]] = Field(default_factory=list)
    lab_sample_date: Optional[str] = None
    notes: Optional[str] = None


class SoilProfileOut(SoilProfileInput):
    id: str
    farm_id: str
    data_origin: str
    completeness_pct: float
    missing_parameters: List[str]
    updated_at: datetime


class FarmOut(BaseModel):
    id: str
    name: str
    region: str
    farming_system: str
    geometry_geojson: Dict[str, Any]
    centroid_lat: float
    centroid_lon: float
    area_hectares: float
    perimeter_meters: float
    elevation_m: Optional[float] = None
    analysis_start_date: str
    analysis_end_date: str
    is_demo: bool
    data_origin: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    soil_profile: Optional[SoilProfileOut] = None

