from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.analytics.climate import compute_climate_and_water_trends
from app.analytics.vegetation import analyze_vegetation_series
from app.database.session import get_db
from app.models.farm import Farm
from app.services.observation_service import gather_earth_observations

router = APIRouter(prefix="/api/farms", tags=["NASA Earth Observations & Climate Trends"])


@router.get("/{farm_id}/earth-observations")
async def get_earth_observations(
    farm_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    force_refresh: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")

    obs = await gather_earth_observations(db, farm, start_date=start_date, end_date=end_date, force_refresh=force_refresh)
    power_records = obs["power"].get("records") or []
    veg_analysis = analyze_vegetation_series(obs["modis"], obs["gee"])

    return {
        "farm_id": farm.id,
        "observation_period": obs["observation_period"],
        "power_summary": {
            "status": obs["power"].get("status"),
            "cache_hit": obs["power"].get("cache_hit", False),
            "summary": obs["power"].get("summary", {}),
            "recent_daily": power_records[-14:],
            "provenance": obs["power"].get("provenance"),
        },
        "modis": {
            "status": obs["modis"].get("status"),
            "cache_hit": obs["modis"].get("cache_hit", False),
            "summary": obs["modis"].get("summary", {}),
            "vegetation_analysis": veg_analysis,
            "provenance": obs["modis"].get("provenance"),
        },
        "landsat_stac": obs["landsat_stac"],
        "srtm": obs["srtm"],
        "gee": obs["gee"],
        "gibs_layers": obs["gibs_layers"],
        "provenance": obs["provenance"],
    }


@router.get("/{farm_id}/climate-trends")
async def get_climate_trends(
    farm_id: str,
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    compare_year_a: Optional[int] = Query(default=None),
    compare_year_b: Optional[int] = Query(default=None),
    force_refresh: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")

    obs = await gather_earth_observations(db, farm, start_date=start_date, end_date=end_date, force_refresh=force_refresh)
    climate = compute_climate_and_water_trends(obs["power"], compare_year_a=compare_year_a, compare_year_b=compare_year_b)
    vegetation = analyze_vegetation_series(obs["modis"], obs["gee"])

    return {
        "farm_id": farm.id,
        "observation_period": obs["observation_period"],
        "climate": climate,
        "vegetation": vegetation,
        "provenance": obs["provenance"],
    }

