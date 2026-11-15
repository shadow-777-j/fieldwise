import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.models.farm import Farm
from app.models.soil import SoilProfile
from app.schemas.farm import FarmCreate, FarmOut, FarmUpdate, SoilProfileInput, SoilProfileOut
from app.services.geometry import compute_geodesic_metrics, extract_polygon_geometry
from app.services.observation_service import serialize_farm, serialize_soil

router = APIRouter(prefix="/api/farms", tags=["Farms & Soil Profiles"])


@router.get("", response_model=List[FarmOut])
def list_farms(db: Session = Depends(get_db)):
    farms = db.query(Farm).order_by(Farm.is_demo.desc(), Farm.created_at.desc()).all()
    return [serialize_farm(f) for f in farms]


@router.post("", response_model=FarmOut, status_code=status.HTTP_201_CREATED)
def create_farm(payload: FarmCreate, db: Session = Depends(get_db)):
    try:
        norm_geom = extract_polygon_geometry(payload.geometry_geojson)
        wkt, lat, lon, area_ha, perim_m = compute_geodesic_metrics(norm_geom)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    farm_id = f"farm-{uuid.uuid4().hex[:10]}"
    farm = Farm(
        id=farm_id,
        name=payload.name.strip(),
        region=payload.region.strip(),
        farming_system=payload.farming_system,
        geometry_geojson=norm_geom,
        geometry_wkt=wkt,
        centroid_lat=lat,
        centroid_lon=lon,
        area_hectares=area_ha,
        perimeter_meters=perim_m,
        analysis_start_date=payload.analysis_start_date,
        analysis_end_date=payload.analysis_end_date,
        is_demo=False,
        data_origin="user_entered",
        notes=payload.notes,
    )
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return serialize_farm(farm)


@router.get("/{farm_id}", response_model=FarmOut)
def get_farm(farm_id: str, db: Session = Depends(get_db)):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")
    return serialize_farm(farm)


@router.put("/{farm_id}", response_model=FarmOut)
def update_farm(farm_id: str, payload: FarmUpdate, db: Session = Depends(get_db)):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")

    if payload.name is not None:
        farm.name = payload.name.strip()
    if payload.region is not None:
        farm.region = payload.region.strip()
    if payload.farming_system is not None:
        farm.farming_system = payload.farming_system
    if payload.analysis_start_date is not None:
        farm.analysis_start_date = payload.analysis_start_date
    if payload.analysis_end_date is not None:
        farm.analysis_end_date = payload.analysis_end_date
    if payload.notes is not None:
        farm.notes = payload.notes

    if payload.geometry_geojson is not None:
        try:
            norm_geom = extract_polygon_geometry(payload.geometry_geojson)
            wkt, lat, lon, area_ha, perim_m = compute_geodesic_metrics(norm_geom)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        farm.geometry_geojson = norm_geom
        farm.geometry_wkt = wkt
        farm.centroid_lat = lat
        farm.centroid_lon = lon
        farm.area_hectares = area_ha
        farm.perimeter_meters = perim_m
        farm.elevation_m = None  # Refresh elevation on boundary move

    db.commit()
    db.refresh(farm)
    return serialize_farm(farm)


@router.delete("/{farm_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_farm(farm_id: str, db: Session = Depends(get_db)):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")
    db.delete(farm)
    db.commit()
    return None


@router.get("/{farm_id}/soil-profile", response_model=SoilProfileOut)
def get_soil_profile(farm_id: str, db: Session = Depends(get_db)):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")
    if not farm.soil_profile:
        raise HTTPException(status_code=404, detail="No soil profile recorded yet for this farm.")
    return serialize_soil(farm.soil_profile)


@router.post("/{farm_id}/soil-profile", response_model=SoilProfileOut)
def upsert_soil_profile(farm_id: str, payload: SoilProfileInput, db: Session = Depends(get_db)):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")

    soil = farm.soil_profile
    if not soil:
        soil = SoilProfile(id=f"soil-{uuid.uuid4().hex[:10]}", farm_id=farm.id)
        db.add(soil)

    for field in (
        "ph",
        "ec_ds_m",
        "organic_carbon_pct",
        "nitrogen_kg_ha",
        "phosphorus_kg_ha",
        "potassium_kg_ha",
        "soil_texture",
        "field_soil_moisture_pct",
        "salinity_class",
        "irrigation_availability",
        "drainage_class",
        "waterlogging_history",
        "farmer_constraints",
        "crop_history",
        "lab_sample_date",
        "notes",
    ):
        setattr(soil, field, getattr(payload, field))

    soil.data_origin = "user_entered"
    db.commit()
    db.refresh(soil)
    return serialize_soil(soil)

