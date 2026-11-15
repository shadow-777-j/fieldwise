from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class RotationWeights(BaseModel):
    water_sustainability: float = Field(default=25.0, ge=0.0, le=100.0)
    soil_improvement: float = Field(default=25.0, ge=0.0, le=100.0)
    climate_resilience: float = Field(default=20.0, ge=0.0, le=100.0)
    economic_potential: float = Field(default=15.0, ge=0.0, le=100.0)
    erosion_protection: float = Field(default=10.0, ge=0.0, le=100.0)
    farmer_preference: float = Field(default=5.0, ge=0.0, le=100.0)


class RotationScenariosRequest(BaseModel):
    weights: Optional[RotationWeights] = None
    farmer_constraints: Optional[Dict[str, Any]] = None


class ClimateSimulationRequest(BaseModel):
    rainfall_delta_pct: float = Field(default=0.0, ge=-20.0, le=20.0)
    temperature_delta_c: float = Field(default=0.0, ge=-1.0, le=3.0)
    water_availability_delta_pct: float = Field(default=0.0, ge=-30.0, le=30.0)
    season_shift_days: int = Field(default=0, ge=-30, le=30)
    weights: Optional[RotationWeights] = None

