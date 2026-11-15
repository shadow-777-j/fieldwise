from datetime import datetime, timezone
from typing import Any, Dict, List
import httpx
from sqlalchemy.orm import Session
from app.config.settings import get_settings
from app.satellite.cache import get_cached_observation, set_cached_observation


async def fetch_landsat_stac_scenes(
    db: Session,
    geometry_geojson: Dict[str, Any],
    start_date: str,
    end_date: str,
    limit: int = 12,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """Query real USGS/AWS Earth Search STAC catalog for Landsat 8/9 C2 L2 scenes covering the farm."""
    settings = get_settings()
    coords_sig = str(geometry_geojson.get("coordinates", [])[:1])[:60]
    cache_key = f"earth_search_landsat:{hash(coords_sig)}:{start_date}:{end_date}:{limit}"
    if not force_refresh:
        cached = get_cached_observation(db, cache_key)
        if cached:
            cached["cache_hit"] = True
            return cached

    fetched_at = datetime.now(timezone.utc).isoformat()
    body = {
        "collections": ["landsat-c2-l2"],
        "intersects": geometry_geojson,
        "datetime": f"{start_date}T00:00:00Z/{end_date}T23:59:59Z",
        "limit": limit,
        "sortby": [{"field": "properties.datetime", "direction": "desc"}],
    }

    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout_seconds) as client:
            resp = await client.post(f"{settings.earth_search_stac_url}/search", json=body)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        return {
            "status": "unavailable",
            "error": str(exc),
            "cache_hit": False,
            "scenes": [],
            "provenance": {
                "source_name": "USGS / Element84 Earth Search STAC",
                "product_identifier": "landsat-c2-l2 (LC08 / LC09 Collection 2 Level 2)",
                "observation_period": f"{start_date} to {end_date}",
                "spatial_resolution": "30 m (OLI/TIRS bands SR_B2, SR_B4, SR_B5, QA_PIXEL)",
                "temporal_resolution": "8-day combined revisit (Landsat 8 + 9)",
                "processing_date": fetched_at,
                "missing_data_status": f"STAC query failed: {exc}",
                "data_origin": "historical_satellite",
            },
        }

    scenes: List[Dict[str, Any]] = []
    for feat in data.get("features", []):
        props = feat.get("properties", {})
        scenes.append(
            {
                "scene_id": feat.get("id"),
                "datetime": props.get("datetime"),
                "date": (props.get("datetime") or "")[:10],
                "platform": props.get("platform"),
                "cloud_cover_pct": props.get("eo:cloud_cover"),
                "sun_elevation": props.get("view:sun_elevation"),
                "wrs_path": props.get("landsat:wrs_path"),
                "wrs_row": props.get("landsat:wrs_row"),
            }
        )

    low_cloud = [s for s in scenes if (s.get("cloud_cover_pct") or 100) < 35]
    payload = {
        "status": "metadata_only" if scenes else "insufficient_data",
        "cache_hit": False,
        "scenes": scenes,
        "summary": {
            "total_scenes_found": len(scenes),
            "low_cloud_scenes_lt35pct": len(low_cloud),
            "latest_scene_date": scenes[0]["date"] if scenes else None,
            "latest_low_cloud_date": low_cloud[0]["date"] if low_cloud else None,
        },
        "provenance": {
            "source_name": "USGS / Element84 Earth Search STAC (Scene Catalog)",
            "product_identifier": "landsat-c2-l2 (LANDSAT/LC08/C02/T1_L2 & LC09/C02/T1_L2)",
            "observation_period": f"{start_date} to {end_date}",
            "spatial_resolution": "30 m",
            "temporal_resolution": "8–16 day revisit",
            "processing_date": fetched_at,
            "missing_data_status": (
                f"{len(scenes)} Landsat C2 L2 overpass scenes cataloged ({len(low_cloud)} with <35% scene cloud cover). "
                "Pixel-level surface reflectance extraction requires authenticated Google Earth Engine."
            ),
            "data_origin": "historical_satellite",
        },
    }
    set_cached_observation(db, cache_key, "EARTH_SEARCH_LANDSAT_STAC", payload)
    return payload

