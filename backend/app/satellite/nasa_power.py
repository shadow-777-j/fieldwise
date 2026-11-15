from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.orm import Session
from app.config.settings import get_settings
from app.satellite.cache import get_cached_observation, set_cached_observation

POWER_PARAMETERS = [
    "T2M",
    "T2M_MAX",
    "T2M_MIN",
    "PRECTOTCORR",
    "ALLSKY_SFC_SW_DWN",
    "RH2M",
    "WS2M",
    "GWETTOP",
    "GWETROOT",
    "EVPTRNS",
]

LATENT_HEAT_VAPORIZATION_MJ_PER_KG = 2.45


def _clean_power_val(val: Any, fill_value: float = -999.0) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
    except (TypeError, ValueError):
        return None
    if f <= fill_value + 0.01 or f == -999.0:
        return None
    return round(f, 4)


def _format_yyyymmdd(iso_date: str) -> str:
    return iso_date.replace("-", "")[:8]


async def fetch_nasa_power_daily(
    db: Session,
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """Fetch real daily NASA POWER agroclimatology data with caching, timeout, and missing-data tracking."""
    settings = get_settings()
    # Clamp end_date to today (POWER does not return future dates)
    today_str = date.today().isoformat()
    effective_end = min(end_date, today_str)
    if effective_end < start_date:
        effective_end = today_str

    cache_key = f"nasa_power:{round(lat, 3)}:{round(lon, 3)}:{start_date}:{effective_end}"
    if not force_refresh:
        cached = get_cached_observation(db, cache_key)
        if cached:
            cached["cache_hit"] = True
            return cached

    params = {
        "parameters": ",".join(POWER_PARAMETERS),
        "community": "AG",
        "longitude": round(lon, 5),
        "latitude": round(lat, 5),
        "start": _format_yyyymmdd(start_date),
        "end": _format_yyyymmdd(effective_end),
        "format": "JSON",
    }

    fetched_at = datetime.now(timezone.utc).isoformat()
    try:
        async with httpx.AsyncClient(timeout=settings.http_timeout_seconds) as client:
            resp = await client.get(settings.nasa_power_base_url, params=params)
            resp.raise_for_status()
            raw = resp.json()
    except Exception as exc:
        return {
            "status": "unavailable",
            "error": str(exc),
            "cache_hit": False,
            "provenance": {
                "source_name": "NASA POWER (MERRA-2 / CERES SYN1deg)",
                "product_identifier": "POWER Daily Point API (community=AG)",
                "observation_period": f"{start_date} to {effective_end}",
                "spatial_resolution": "0.5° × 0.625° (MERRA-2, ~55 km); 1.0° × 1.0° (SYN1DEG irradiance)",
                "temporal_resolution": "Daily",
                "processing_date": fetched_at,
                "missing_data_status": "Retrieval failed — network or upstream timeout",
                "data_origin": "live_retrieved",
            },
            "records": [],
        }

    header = raw.get("header", {})
    fill_value = float(header.get("fill_value", -999.0))
    prop_params = raw.get("properties", {}).get("parameter", {})
    all_dates = sorted(prop_params.get("T2M", {}).keys())

    records: List[Dict[str, Any]] = []
    missing_counts = {p: 0 for p in POWER_PARAMETERS}
    total_days = len(all_dates)

    for dkey in all_dates:
        iso = f"{dkey[:4]}-{dkey[4:6]}-{dkey[6:8]}"
        t2m = _clean_power_val(prop_params.get("T2M", {}).get(dkey), fill_value)
        tmax = _clean_power_val(prop_params.get("T2M_MAX", {}).get(dkey), fill_value)
        tmin = _clean_power_val(prop_params.get("T2M_MIN", {}).get(dkey), fill_value)
        precip = _clean_power_val(prop_params.get("PRECTOTCORR", {}).get(dkey), fill_value)
        solar = _clean_power_val(prop_params.get("ALLSKY_SFC_SW_DWN", {}).get(dkey), fill_value)
        rh = _clean_power_val(prop_params.get("RH2M", {}).get(dkey), fill_value)
        ws = _clean_power_val(prop_params.get("WS2M", {}).get(dkey), fill_value)
        gwettop = _clean_power_val(prop_params.get("GWETTOP", {}).get(dkey), fill_value)
        gwetroot = _clean_power_val(prop_params.get("GWETROOT", {}).get(dkey), fill_value)
        evptrns = _clean_power_val(prop_params.get("EVPTRNS", {}).get(dkey), fill_value)

        et_mm = round(evptrns / LATENT_HEAT_VAPORIZATION_MJ_PER_KG, 3) if evptrns is not None else None
        p_minus_et = round(precip - et_mm, 3) if (precip is not None and et_mm is not None) else None

        row_vals = {
            "T2M": t2m,
            "T2M_MAX": tmax,
            "T2M_MIN": tmin,
            "PRECTOTCORR": precip,
            "ALLSKY_SFC_SW_DWN": solar,
            "RH2M": rh,
            "WS2M": ws,
            "GWETTOP": gwettop,
            "GWETROOT": gwetroot,
            "EVPTRNS": evptrns,
        }
        for k, v in row_vals.items():
            if v is None:
                missing_counts[k] += 1

        records.append(
            {
                "date": iso,
                "t2m": t2m,
                "t2m_max": tmax,
                "t2m_min": tmin,
                "precip_mm": precip,
                "solar_mj_m2": solar,
                "rh2m_pct": rh,
                "wind_ms": ws,
                "gwettop": gwettop,
                "gwetroot": gwetroot,
                "evptrns_mj_m2": evptrns,
                "et_mm": et_mm,
                "partial_water_balance_mm": p_minus_et,
            }
        )

    valid_days = sum(1 for r in records if r["t2m"] is not None or r["precip_mm"] is not None)
    missing_pct = round(((total_days - valid_days) / total_days) * 100.0, 2) if total_days else 100.0
    missing_summary = (
        f"{valid_days}/{total_days} valid observation days ({missing_pct}% missing core rows); "
        f"GWETTOP missing {missing_counts['GWETTOP']}d, EVPTRNS missing {missing_counts['EVPTRNS']}d"
    )

    sources_list = header.get("sources", ["MERRA2", "SYN1DEG", "POWER"])
    api_ver = header.get("api", {}).get("version", "v2")

    payload = {
        "status": "available" if valid_days > 0 else "insufficient_data",
        "cache_hit": False,
        "provenance": {
            "source_name": f"NASA POWER ({', '.join(sources_list)})",
            "product_identifier": f"POWER Daily Point API {api_ver} (community=AG)",
            "observation_period": f"{records[0]['date']} to {records[-1]['date']}" if records else f"{start_date} to {effective_end}",
            "spatial_resolution": "0.5° × 0.625° (~55 km MERRA-2 meteorology/soil wetness); 1.0° × 1.0° (SYN1DEG solar)",
            "temporal_resolution": "Daily (LST)",
            "processing_date": fetched_at,
            "missing_data_status": missing_summary,
            "data_origin": "live_retrieved",
            "resolution_caveat": (
                "Regional ~55 km grid cell; reflects macro-meteorological conditions rather than field-to-field microclimate."
            ),
        },
        "summary": {
            "total_days": total_days,
            "valid_days": valid_days,
            "missing_counts": missing_counts,
            "grid_elevation_m": raw.get("geometry", {}).get("coordinates", [None, None, None])[2],
        },
        "records": records,
    }

    if valid_days > 0:
        set_cached_observation(db, cache_key, "NASA_POWER", payload)
    return payload

