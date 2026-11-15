from datetime import datetime, timezone
from typing import Any, Dict, List
import httpx
from sqlalchemy.orm import Session
from app.config.settings import get_settings
from app.satellite.cache import get_cached_observation, set_cached_observation


async def fetch_srtm_elevation_profile(
    db: Session,
    centroid_lat: float,
    centroid_lon: float,
    geometry_geojson: Dict[str, Any],
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """Fetch 30 m NASA/USGS SRTM elevation values for the farm centroid and boundary vertices."""
    settings = get_settings()
    cache_key = f"srtm30m:{round(centroid_lat, 4)}:{round(centroid_lon, 4)}"
    if not force_refresh:
        cached = get_cached_observation(db, cache_key)
        if cached:
            cached["cache_hit"] = True
            return cached

    coords: List[List[float]] = []
    gtype = geometry_geojson.get("type")
    if gtype == "Polygon":
        coords = (geometry_geojson.get("coordinates") or [[]])[0]
    elif gtype == "MultiPolygon":
        coords = ((geometry_geojson.get("coordinates") or [[[]]])[0])[0]

    sample_points = [(centroid_lat, centroid_lon)]
    for pt in coords[:8]:
        if isinstance(pt, (list, tuple)) and len(pt) >= 2:
            sample_points.append((float(pt[1]), float(pt[0])))

    loc_str = "|".join(f"{round(lat, 5)},{round(lon, 5)}" for lat, lon in sample_points)
    fetched_at = datetime.now(timezone.utc).isoformat()

    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout_seconds) as client:
            resp = await client.get(settings.open_topo_srtm_url, params={"locations": loc_str})
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        return {
            "status": "unavailable",
            "error": str(exc),
            "cache_hit": False,
            "provenance": {
                "source_name": "NASA/USGS SRTMGL1 via OpenTopoData",
                "product_identifier": "srtm30m (USGS/SRTMGL1_003)",
                "observation_period": "2000-02-11 to 2000-02-22 (static DEM)",
                "spatial_resolution": "30 m (1 arc-second)",
                "temporal_resolution": "Static",
                "processing_date": fetched_at,
                "missing_data_status": f"Retrieval failed: {exc}",
                "data_origin": "historical_satellite",
            },
            "summary": {},
        }

    elevs = [r["elevation"] for r in data.get("results", []) if r.get("elevation") is not None]
    if not elevs:
        return {"status": "insufficient_data", "cache_hit": False, "summary": {}, "provenance": {}}

    centroid_elev = float(elevs[0])
    min_elev = float(min(elevs))
    max_elev = float(max(elevs))
    mean_elev = round(sum(elevs) / len(elevs), 2)
    relief = round(max_elev - min_elev, 2)

    terrain_context = (
        "Low-lying tidal/coastal floodplain (< 3 m ASL) — susceptible to tidal saline intrusion & monsoon inundation"
        if mean_elev < 3.0
        else (
            "Lowland alluvial basin (3–25 m ASL)"
            if mean_elev < 25.0
            else "Midland / upland agricultural terrain (>= 25 m ASL)"
        )
    )

    payload = {
        "status": "available",
        "cache_hit": False,
        "provenance": {
            "source_name": "NASA/USGS SRTMGL1 (via OpenTopoData srtm30m)",
            "product_identifier": "SRTMGL1 1-arc-second DEM (USGS/SRTMGL1_003)",
            "observation_period": "February 2000 baseline terrain",
            "spatial_resolution": "30 m (1 arc-second)",
            "temporal_resolution": "Static terrain baseline",
            "processing_date": fetched_at,
            "missing_data_status": f"{len(elevs)}/{len(sample_points)} boundary/centroid sample points retrieved",
            "data_origin": "historical_satellite",
            "resolution_caveat": "30 m vertical integer/meter quantization (±few meters vertical accuracy in vegetated wetlands).",
        },
        "summary": {
            "centroid_elevation_m": round(centroid_elev, 2),
            "mean_elevation_m": mean_elev,
            "min_elevation_m": round(min_elev, 2),
            "max_elevation_m": round(max_elev, 2),
            "local_relief_m": relief,
            "terrain_context": terrain_context,
        },
    }
    set_cached_observation(db, cache_key, "SRTM30M", payload, ttl_hours=24 * 14)
    return payload

