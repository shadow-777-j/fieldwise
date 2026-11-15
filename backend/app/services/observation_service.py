import asyncio
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.models.farm import Farm
from app.models.soil import SoilProfile
from app.satellite.earth_engine import check_gee_auth_status, fetch_gee_landsat_and_smap_sync
from app.satellite.earth_search import fetch_landsat_stac_scenes
from app.satellite.nasa_gibs import get_nasa_gibs_layers
from app.satellite.nasa_power import fetch_nasa_power_daily
from app.satellite.ornl_modis import fetch_ornl_modis_mod13q1
from app.satellite.srtm import fetch_srtm_elevation_profile

CORE_SOIL_FIELDS = [
    ("ph", "Soil pH"),
    ("ec_ds_m", "Electrical Conductivity (EC)"),
    ("organic_carbon_pct", "Organic Carbon (%)"),
    ("nitrogen_kg_ha", "Available Nitrogen (N)"),
    ("phosphorus_kg_ha", "Available Phosphorus (P)"),
    ("potassium_kg_ha", "Available Potassium (K)"),
    ("soil_texture", "Soil Texture"),
    ("field_soil_moisture_pct", "Field Soil Moisture (%)"),
    ("salinity_class", "Salinity Class"),
    ("irrigation_availability", "Irrigation Availability"),
    ("drainage_class", "Drainage Class"),
    ("waterlogging_history", "Waterlogging History"),
]


def serialize_soil(soil: Optional[SoilProfile]) -> Optional[Dict[str, Any]]:
    if not soil:
        return None
    missing: List[str] = []
    for attr, label in CORE_SOIL_FIELDS:
        val = getattr(soil, attr)
        if val is None or (isinstance(val, str) and val.lower() in ("", "unknown")):
            missing.append(label)
    total = len(CORE_SOIL_FIELDS)
    completeness = round(((total - len(missing)) / total) * 100.0, 1)
    return {
        "id": soil.id,
        "farm_id": soil.farm_id,
        "ph": soil.ph,
        "ec_ds_m": soil.ec_ds_m,
        "organic_carbon_pct": soil.organic_carbon_pct,
        "nitrogen_kg_ha": soil.nitrogen_kg_ha,
        "phosphorus_kg_ha": soil.phosphorus_kg_ha,
        "potassium_kg_ha": soil.potassium_kg_ha,
        "soil_texture": soil.soil_texture,
        "field_soil_moisture_pct": soil.field_soil_moisture_pct,
        "salinity_class": soil.salinity_class,
        "irrigation_availability": soil.irrigation_availability,
        "drainage_class": soil.drainage_class,
        "waterlogging_history": soil.waterlogging_history,
        "farmer_constraints": soil.farmer_constraints or {},
        "crop_history": soil.crop_history or [],
        "data_origin": soil.data_origin,
        "lab_sample_date": soil.lab_sample_date,
        "notes": soil.notes,
        "completeness_pct": completeness,
        "missing_parameters": missing,
        "updated_at": soil.updated_at,
    }


def serialize_farm(farm: Farm) -> Dict[str, Any]:
    return {
        "id": farm.id,
        "name": farm.name,
        "region": farm.region,
        "farming_system": farm.farming_system,
        "geometry_geojson": farm.geometry_geojson,
        "centroid_lat": farm.centroid_lat,
        "centroid_lon": farm.centroid_lon,
        "area_hectares": farm.area_hectares,
        "perimeter_meters": farm.perimeter_meters,
        "elevation_m": farm.elevation_m,
        "analysis_start_date": farm.analysis_start_date,
        "analysis_end_date": farm.analysis_end_date,
        "is_demo": farm.is_demo,
        "data_origin": farm.data_origin,
        "notes": farm.notes,
        "created_at": farm.created_at,
        "updated_at": farm.updated_at,
        "soil_profile": serialize_soil(farm.soil_profile),
    }


async def gather_earth_observations(
    db: Session,
    farm: Farm,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    s_date = start_date or farm.analysis_start_date
    e_date = end_date or farm.analysis_end_date

    power_task = fetch_nasa_power_daily(db, farm.centroid_lat, farm.centroid_lon, s_date, e_date, force_refresh=force_refresh)
    modis_task = fetch_ornl_modis_mod13q1(db, farm.centroid_lat, farm.centroid_lon, s_date, e_date, force_refresh=force_refresh)
    stac_task = fetch_landsat_stac_scenes(db, farm.geometry_geojson, s_date, e_date, force_refresh=force_refresh)
    srtm_task = fetch_srtm_elevation_profile(db, farm.centroid_lat, farm.centroid_lon, farm.geometry_geojson, force_refresh=force_refresh)
    gibs_task = get_nasa_gibs_layers(db)

    power, modis, landsat_stac, srtm, gibs_layers = await asyncio.gather(
        power_task, modis_task, stac_task, srtm_task, gibs_task
    )

    # Update farm elevation if previously unset and SRTM succeeded
    if farm.elevation_m is None and srtm.get("status") == "available":
        elev = srtm.get("summary", {}).get("centroid_elevation_m")
        if elev is not None:
            farm.elevation_m = elev
            db.commit()

    # Run GEE extraction synchronously in worker thread ONLY if authenticated
    gee_auth = check_gee_auth_status()
    if gee_auth["authenticated"]:
        gee_data = await asyncio.to_thread(fetch_gee_landsat_and_smap_sync, farm.geometry_geojson, s_date, e_date)
    else:
        gee_data = {
            "status": "authentication_required",
            "authenticated": False,
            "reason": gee_auth["reason"],
            "setup_instructions": gee_auth["setup_instructions"],
            "landsat_records": [],
            "landsat_tile_url": None,
            "smap_summary": None,
            "provenance": {
                "source_name": "Google Earth Engine (Landsat 8/9 C2 L2, GPM V07, SMAP L4)",
                "product_identifier": "LANDSAT/LC08/C02/T1_L2 + LANDSAT/LC09/C02/T1_L2",
                "observation_period": f"{s_date} to {e_date}",
                "spatial_resolution": "30 m (Landsat), 9 km (SMAP), ~11 km (GPM)",
                "temporal_resolution": "8–16 day (Landsat)",
                "processing_date": power.get("provenance", {}).get("processing_date"),
                "missing_data_status": f"GEE Auth Required: {gee_auth['reason']}",
                "data_origin": "historical_satellite",
            },
        }

    provenance = [
        p
        for p in [
            power.get("provenance"),
            modis.get("provenance"),
            landsat_stac.get("provenance"),
            srtm.get("provenance"),
            gee_data.get("provenance"),
        ]
        if p
    ]

    return {
        "farm_id": farm.id,
        "observation_period": {"start": s_date, "end": e_date},
        "power": power,
        "modis": modis,
        "landsat_stac": landsat_stac,
        "srtm": srtm,
        "gee": gee_data,
        "gibs_layers": gibs_layers,
        "provenance": provenance,
    }

