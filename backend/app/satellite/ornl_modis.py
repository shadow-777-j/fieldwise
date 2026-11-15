import asyncio
import ssl
from datetime import datetime, timezone
from typing import Any, Dict, List
import httpx
import truststore
from sqlalchemy.orm import Session
from app.config.settings import get_settings
from app.satellite.cache import get_cached_observation, set_cached_observation

_TRUSTSTORE_CTX = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)


def _scale_modis_index(raw_val: int) -> float | None:
    # MOD13Q1 valid range -2000 to 10000 with scale factor 0.0001; fill value -3000
    if raw_val is None or raw_val < -2000 or raw_val > 10000:
        return None
    return round(raw_val * 0.0001, 4)


async def fetch_ornl_modis_mod13q1(
    db: Session,
    lat: float,
    lon: float,
    start_date: str,
    end_date: str,
    max_composites: int = 70,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """Fetch real NASA/ORNL DAAC MODIS MOD13Q1 (250m, 16-day) NDVI, EVI, and QA pixel reliability."""
    settings = get_settings()
    cache_key = f"ornl_modis:{round(lat, 4)}:{round(lon, 4)}:{start_date}:{end_date}:{max_composites}"
    if not force_refresh:
        cached = get_cached_observation(db, cache_key)
        if cached:
            cached["cache_hit"] = True
            return cached

    fetched_at = datetime.now(timezone.utc).isoformat()
    base_url = settings.ornl_modis_base_url

    try:
        async with httpx.AsyncClient(verify=_TRUSTSTORE_CTX, timeout=settings.http_timeout_seconds) as client:
            dates_resp = await client.get(
                f"{base_url}/MOD13Q1/dates",
                params={"latitude": round(lat, 5), "longitude": round(lon, 5)},
            )
            dates_resp.raise_for_status()
            all_dates = dates_resp.json().get("dates", [])

            filtered = [
                d for d in all_dates
                if start_date <= d.get("calendar_date", "") <= end_date
            ]
            if not filtered:
                # Fallback to most recent dates up to max_composites if user picked future/narrow date range
                filtered = [d for d in all_dates if d.get("calendar_date", "") <= end_date][-max_composites:]
            else:
                # Keep evenly spaced / most recent up to max_composites to keep API respectful & fast
                if len(filtered) > max_composites:
                    filtered = filtered[-max_composites:]

            if not filtered:
                return {
                    "status": "insufficient_data",
                    "cache_hit": False,
                    "provenance": {
                        "source_name": "NASA LP DAAC / ORNL MODIS Global Subsets",
                        "product_identifier": "MOD13Q1 v061 (Terra 16-Day 250 m VI)",
                        "observation_period": f"{start_date} to {end_date}",
                        "spatial_resolution": "250 m (native sinusoidal ~231.66 m)",
                        "temporal_resolution": "16-day composite",
                        "processing_date": fetched_at,
                        "missing_data_status": "No MODIS composite dates available for selected period",
                        "data_origin": "live_retrieved",
                    },
                    "records": [],
                }

            # ORNL API limits /subset requests to 10 composite dates per request
            chunks = [filtered[i : i + 10] for i in range(0, len(filtered), 10)]
            sem = asyncio.Semaphore(5)

            async def _fetch_chunk_band(chunk: List[Dict[str, str]], band: str) -> Dict[str, Any]:
                async with sem:
                    r = await client.get(
                        f"{base_url}/MOD13Q1/subset",
                        params={
                            "latitude": round(lat, 5),
                            "longitude": round(lon, 5),
                            "band": band,
                            "startDate": chunk[0]["modis_date"],
                            "endDate": chunk[-1]["modis_date"],
                            "kmAboveBelow": 0,
                            "kmLeftRight": 0,
                        },
                    )
                    r.raise_for_status()
                    return r.json()

            tasks = []
            for ch in chunks:
                tasks.append(_fetch_chunk_band(ch, "250m_16_days_NDVI"))
                tasks.append(_fetch_chunk_band(ch, "250m_16_days_EVI"))
                tasks.append(_fetch_chunk_band(ch, "250m_16_days_pixel_reliability"))

            results = await asyncio.gather(*tasks)

            merged: Dict[str, Dict[str, Any]] = {}
            tile_id = None
            cellsize = None
            for res in results:
                cellsize = cellsize or res.get("cellsize")
                for row in res.get("subset", []):
                    mdate = row["modis_date"]
                    cdate = row["calendar_date"]
                    tile_id = tile_id or row.get("tile")
                    entry = merged.setdefault(
                        mdate,
                        {
                            "modis_date": mdate,
                            "date": cdate,
                            "tile": row.get("tile"),
                            "ndvi": None,
                            "evi": None,
                            "pixel_reliability": None,
                            "qa_label": "Unknown",
                            "cloud_free": False,
                        },
                    )
                    val = row.get("data", [None])[0]
                    band = row.get("band", "")
                    if band.endswith("NDVI"):
                        entry["ndvi"] = _scale_modis_index(val)
                    elif band.endswith("EVI"):
                        entry["evi"] = _scale_modis_index(val)
                    elif band.endswith("pixel_reliability"):
                        entry["pixel_reliability"] = val
                        # MOD13Q1 Pixel Reliability: 0=Good, 1=Marginal, 2=Snow/Ice, 3=Cloudy, -1=Fill
                        qa_map = {
                            0: "Good data (use with confidence)",
                            1: "Marginal data (useful, check other QA)",
                            2: "Snow/Ice target",
                            3: "Cloudy target (masked)",
                            -1: "Fill / No data",
                        }
                        entry["qa_label"] = qa_map.get(val, f"Code {val}")
                        entry["cloud_free"] = val in (0, 1)

            records = sorted(merged.values(), key=lambda x: x["date"])
            # Mask out cloudy/fill pixels from primary high-confidence series while preserving raw QA count
            good_or_marginal = [r for r in records if r["cloud_free"] and r["ndvi"] is not None]
            cloudy_or_fill = len(records) - len(good_or_marginal)
            fill_count = sum(1 for r in records if r.get("pixel_reliability") == -1)
            if records and len(good_or_marginal) == 0 and fill_count == len(records):
                missing_desc = (
                    f"0/{len(records)} QA-valid composites: all composites flagged -1 "
                    "(Fill / MODIS 250 m land-water mask at centroid — plot centroid may intersect estuary water)."
                )
            else:
                missing_desc = (
                    f"{len(good_or_marginal)}/{len(records)} QA-valid (good/marginal) composites; "
                    f"{cloudy_or_fill} cloudy/fill composites flagged"
                )

            payload = {
                "status": "available" if records else "insufficient_data",
                "cache_hit": False,
                "provenance": {
                    "source_name": "NASA LP DAAC / ORNL MODIS Global Subsets",
                    "product_identifier": f"MOD13Q1 v061 (Tile {tile_id or 'unknown'})",
                    "observation_period": f"{records[0]['date']} to {records[-1]['date']}",
                    "spatial_resolution": f"250 m native (~{round(float(cellsize), 1) if cellsize else 231.7} m sinusoidal pixel)",
                    "temporal_resolution": "16-day composite",
                    "processing_date": fetched_at,
                    "missing_data_status": missing_desc,
                    "data_origin": "historical_satellite",
                    "resolution_caveat": (
                        "250 m pixel covers ~6.25 ha and may blend small adjacent paddy bunds or canals in Kumbalangi."
                    ),
                },
                "summary": {
                    "total_composites": len(records),
                    "qa_valid_composites": len(good_or_marginal),
                    "cloudy_or_fill_composites": cloudy_or_fill,
                    "latest_valid_ndvi": good_or_marginal[-1]["ndvi"] if good_or_marginal else None,
                    "latest_valid_evi": good_or_marginal[-1]["evi"] if good_or_marginal else None,
                    "latest_valid_date": good_or_marginal[-1]["date"] if good_or_marginal else None,
                },
                "records": records,
            }
            set_cached_observation(db, cache_key, "ORNL_MODIS_MOD13Q1", payload)
            return payload

    except Exception as exc:
        return {
            "status": "unavailable",
            "error": str(exc),
            "cache_hit": False,
            "provenance": {
                "source_name": "NASA LP DAAC / ORNL MODIS Global Subsets",
                "product_identifier": "MOD13Q1 v061",
                "observation_period": f"{start_date} to {end_date}",
                "spatial_resolution": "250 m",
                "temporal_resolution": "16-day",
                "processing_date": fetched_at,
                "missing_data_status": f"Retrieval error: {exc}",
                "data_origin": "historical_satellite",
            },
            "records": [],
        }

