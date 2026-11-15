from fastapi import APIRouter
from app.config.settings import get_settings
from app.satellite.earth_engine import check_gee_auth_status

router = APIRouter(prefix="/api", tags=["System & Connectivity"])


@router.get("/health")
def health_check():
    return {"status": "ok", "service": "FIELDWISE AI API"}


@router.get("/system/status")
def system_status():
    settings = get_settings()
    gee = check_gee_auth_status()
    return {
        "app_name": settings.app_name,
        "version": settings.app_version,
        "database_backend": "PostgreSQL + PostGIS" if settings.is_postgres else "SQLite (Local Persistence; PostGIS-ready)",
        "data_services": {
            "nasa_power": {
                "status": "enabled",
                "endpoint": settings.nasa_power_base_url,
                "auth_required": False,
            },
            "ornl_modis": {
                "status": "enabled",
                "endpoint": settings.ornl_modis_base_url,
                "auth_required": False,
            },
            "nasa_gibs": {
                "status": "enabled",
                "endpoint": settings.nasa_gibs_wmts_base,
                "auth_required": False,
            },
            "earth_search_stac": {
                "status": "enabled",
                "endpoint": settings.earth_search_stac_url,
                "auth_required": False,
            },
            "srtm_elevation": {
                "status": "enabled",
                "endpoint": settings.open_topo_srtm_url,
                "auth_required": False,
            },
            "google_earth_engine": gee,
        },
    }

