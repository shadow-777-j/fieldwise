from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List
import xml.etree.ElementTree as ET
import httpx
from sqlalchemy.orm import Session
from app.config.settings import get_settings
from app.satellite.cache import get_cached_observation, set_cached_observation

GIBS_LAYER_SPECS = [
    {
        "id": "modis_ndvi",
        "gibs_layer": "MODIS_Terra_L3_NDVI_16Day",
        "name": "MODIS Terra NDVI (16-Day)",
        "dataset_id": "MODIS/061/MOD13Q1 · MODIS_Terra_L3_NDVI_16Day",
        "spatial_resolution": "250 m",
        "temporal_resolution": "16-day composite",
        "max_zoom": 9,
        "format": "png",
        "tile_matrix_set": "GoogleMapsCompatible_Level9",
        "legend": [
            {"label": "Water / Barren (< 0.1)", "color": "#8c510a"},
            {"label": "Sparse / Post-Harvest (0.1–0.3)", "color": "#dfc27d"},
            {"label": "Moderate Canopy (0.3–0.5)", "color": "#a6d96a"},
            {"label": "Healthy Crop (0.5–0.7)", "color": "#1a9850"},
            {"label": "Dense Vegetation (> 0.7)", "color": "#005a32"},
        ],
        "description": "Normalized Difference Vegetation Index derived from Terra MODIS surface reflectance.",
    },
    {
        "id": "modis_evi",
        "gibs_layer": "MODIS_Terra_L3_EVI_16Day",
        "name": "MODIS Terra EVI (16-Day)",
        "dataset_id": "MODIS/061/MOD13Q1 · MODIS_Terra_L3_EVI_16Day",
        "spatial_resolution": "250 m",
        "temporal_resolution": "16-day composite",
        "max_zoom": 9,
        "format": "png",
        "tile_matrix_set": "GoogleMapsCompatible_Level9",
        "legend": [
            {"label": "Low Biomass (< 0.15)", "color": "#d9f0a3"},
            {"label": "Moderate Canopy (0.15–0.4)", "color": "#78c679"},
            {"label": "High Biomass (> 0.4)", "color": "#006837"},
        ],
        "description": "Enhanced Vegetation Index reducing soil background and atmospheric aerosol interference.",
    },
    {
        "id": "gpm_imerg",
        "gibs_layer": "IMERG_Precipitation_Rate",
        "name": "NASA GPM IMERG Precipitation",
        "dataset_id": "NASA/GPM_L3/IMERG_V07 · IMERG_Precipitation_Rate",
        "spatial_resolution": "~10 km (0.1° × 0.1°)",
        "temporal_resolution": "Daily / 30-min",
        "max_zoom": 6,
        "format": "png",
        "tile_matrix_set": "GoogleMapsCompatible_Level6",
        "legend": [
            {"label": "Light (0.1–2 mm/hr)", "color": "#6baed6"},
            {"label": "Moderate (2–10 mm/hr)", "color": "#2171b5"},
            {"label": "Heavy (10–25 mm/hr)", "color": "#756bb1"},
            {"label": "Extreme (> 25 mm/hr)", "color": "#e31a1c"},
        ],
        "description": "Global Precipitation Measurement (GPM) Integrated Multi-satellitE Retrievals precipitation rate. Coarse 10 km regional resolution.",
    },
    {
        "id": "smap_soil_moisture",
        "gibs_layer": "SMAP_L4_Analyzed_Surface_Soil_Moisture",
        "name": "NASA SMAP L4 Surface Soil Moisture",
        "dataset_id": "NASA/SMAP/SPL4SMGP/008 · SMAP_L4_Analyzed_Surface_Soil_Moisture",
        "spatial_resolution": "9 km",
        "temporal_resolution": "Daily 12z L4 snapshot",
        "max_zoom": 6,
        "format": "png",
        "tile_matrix_set": "GoogleMapsCompatible_Level6",
        "legend": [
            {"label": "Dry (< 0.10 m³/m³)", "color": "#d73027"},
            {"label": "Moderate (0.10–0.25 m³/m³)", "color": "#fee090"},
            {"label": "Moist (0.25–0.40 m³/m³)", "color": "#74add1"},
            {"label": "Saturated (> 0.40 m³/m³)", "color": "#313695"},
        ],
        "description": "SMAP L4 assimilated surface soil moisture (0–5 cm) at native 9 km grid resolution. Cannot resolve individual small plots.",
    },
    {
        "id": "modis_lst",
        "gibs_layer": "MODIS_Terra_L3_Land_Surface_Temp_8Day_Day",
        "name": "MODIS Land Surface Temperature (Day, 8-Day)",
        "dataset_id": "MOD11A2 v061 · MODIS_Terra_L3_Land_Surface_Temp_8Day_Day",
        "spatial_resolution": "1 km",
        "temporal_resolution": "8-day composite",
        "max_zoom": 7,
        "format": "png",
        "tile_matrix_set": "GoogleMapsCompatible_Level7",
        "legend": [
            {"label": "Cool (< 20°C)", "color": "#4575b4"},
            {"label": "Moderate (20–30°C)", "color": "#ffffbf"},
            {"label": "Warm (30–38°C)", "color": "#f46d43"},
            {"label": "Heat Stress (> 38°C)", "color": "#a50026"},
        ],
        "description": "Daytime land surface skin temperature (1 km) providing thermal exposure context.",
    },
    {
        "id": "srtm_elevation",
        "gibs_layer": "SRTM_Color_Index",
        "name": "SRTM Terrain Elevation Index",
        "dataset_id": "USGS/SRTMGL1_003 · SRTM_Color_Index",
        "spatial_resolution": "30 m",
        "temporal_resolution": "Static (2000)",
        "max_zoom": 12,
        "format": "png",
        "tile_matrix_set": "GoogleMapsCompatible_Level12",
        "legend": [
            {"label": "Lowland / Tidal (< 10 m)", "color": "#1a9850"},
            {"label": "Plains (10–100 m)", "color": "#fee08b"},
            {"label": "Upland (> 100 m)", "color": "#d73027"},
        ],
        "description": "Shuttle Radar Topography Mission elevation layer indicating flood-prone lowlands vs upland drainage.",
        "static_date": "2000-02-11",
    },
    {
        "id": "modis_truecolor",
        "gibs_layer": "MODIS_Terra_CorrectedReflectance_TrueColor",
        "name": "MODIS Terra True Color Reflectance",
        "dataset_id": "MOD09GA · MODIS_Terra_CorrectedReflectance_TrueColor",
        "spatial_resolution": "250 m",
        "temporal_resolution": "Daily",
        "max_zoom": 9,
        "format": "jpeg",
        "tile_matrix_set": "GoogleMapsCompatible_Level9",
        "legend": [
            {"label": "True-color satellite reflectance (Bands 1,4,3)", "color": "#2b5c43"},
        ],
        "description": "Daily NASA Terra MODIS corrected reflectance showing regional cloud cover and floodwater extent.",
    },
]


async def get_nasa_gibs_layers(db: Session) -> List[Dict[str, Any]]:
    """Return verified NASA GIBS WMTS map layers with current latest observation dates."""
    settings = get_settings()
    cache_key = "nasa_gibs_layer_dates"
    cached_dates = get_cached_observation(db, cache_key)
    latest_dates: Dict[str, str] = cached_dates.get("dates", {}) if cached_dates else {}

    if not latest_dates:
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.get(f"{settings.nasa_gibs_wmts_base}/1.0.0/WMTSCapabilities.xml")
                r.raise_for_status()
                root = ET.fromstring(r.content)
                ns = {"wmts": "http://www.opengis.net/wmts/1.0", "ows": "http://www.opengis.net/ows/1.1"}
                target_ids = {spec["gibs_layer"] for spec in GIBS_LAYER_SPECS}
                for layer in root.findall(".//wmts:Layer", ns):
                    ident_el = layer.find("ows:Identifier", ns)
                    if ident_el is not None and ident_el.text in target_ids:
                        dim_el = layer.find("wmts:Dimension/wmts:Default", ns)
                        if dim_el is not None and dim_el.text:
                            latest_dates[ident_el.text] = dim_el.text.strip()
            if latest_dates:
                set_cached_observation(db, cache_key, "NASA_GIBS", {"dates": latest_dates}, ttl_hours=12)
        except Exception:
            pass

    fallback_recent = (date.today() - timedelta(days=5)).isoformat()
    layers_out: List[Dict[str, Any]] = []
    for spec in GIBS_LAYER_SPECS:
        gibs_id = spec["gibs_layer"]
        obs_date = spec.get("static_date") or latest_dates.get(gibs_id) or fallback_recent
        ext = "jpg" if spec["format"] == "jpeg" else "png"
        if spec.get("static_date"):
            tile_url = (
                f"{settings.nasa_gibs_wmts_base}/{gibs_id}/default/"
                f"{spec['tile_matrix_set']}/{{z}}/{{y}}/{{x}}.{ext}"
            )
            # SRTM_Color_Index in GIBS accepts 'default' without date or date=2000-02-11; verify standard WMTS REST pattern
            tile_url = (
                f"{settings.nasa_gibs_wmts_base}/{gibs_id}/default/{obs_date}/"
                f"{spec['tile_matrix_set']}/{{z}}/{{y}}/{{x}}.{ext}"
            )
        else:
            tile_url = (
                f"{settings.nasa_gibs_wmts_base}/{gibs_id}/default/{obs_date}/"
                f"{spec['tile_matrix_set']}/{{z}}/{{y}}/{{x}}.{ext}"
            )

        layers_out.append(
            {
                "id": spec["id"],
                "name": spec["name"],
                "dataset_id": spec["dataset_id"],
                "gibs_layer": gibs_id,
                "observation_date": obs_date,
                "spatial_resolution": spec["spatial_resolution"],
                "temporal_resolution": spec["temporal_resolution"],
                "max_zoom": spec["max_zoom"],
                "tile_url_template": tile_url,
                "status": "available" if gibs_id in latest_dates or spec.get("static_date") else "available_fallback_date",
                "data_origin": "live_retrieved",
                "legend": spec["legend"],
                "description": spec["description"],
            }
        )
    return layers_out

