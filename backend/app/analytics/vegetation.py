from typing import Any, Dict, List, Optional
import numpy as np


def compute_ndvi(nir: float, red: float) -> Optional[float]:
    denom = nir + red
    if abs(denom) < 1e-9:
        return None
    val = (nir - red) / denom
    return round(float(max(-1.0, min(1.0, val))), 4)


def compute_evi(nir: float, red: float, blue: float) -> Optional[float]:
    denom = nir + 6.0 * red - 7.5 * blue + 1.0
    if abs(denom) < 1e-9:
        return None
    val = 2.5 * (nir - red) / denom
    return round(float(max(-1.0, min(1.0, val))), 4)


def analyze_vegetation_series(modis_payload: Dict[str, Any], landsat_payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Compute QA-filtered vegetation trend, seasonal peak/trough, and anomalies from real satellite series."""
    # Prefer Landsat 30m when GEE is authenticated and returned sufficient records, otherwise MODIS 250m
    landsat_recs = (landsat_payload or {}).get("landsat_records") or []
    modis_recs = modis_payload.get("records") or []

    valid_modis = [r for r in modis_recs if r.get("cloud_free") and r.get("ndvi") is not None]
    primary_source = "MODIS/061/MOD13Q1 (250 m, 16-day, QA-filtered)"
    active_recs = valid_modis

    if len(landsat_recs) >= 6:
        primary_source = "USGS Landsat 8/9 C2 L2 via GEE (30 m, QA_PIXEL cloud-masked)"
        active_recs = landsat_recs

    if len(active_recs) < 4:
        return {
            "status": "insufficient_data",
            "primary_source": primary_source,
            "valid_observations": len(active_recs),
            "mean_ndvi": None,
            "mean_evi": None,
            "latest_ndvi": None,
            "latest_evi": None,
            "latest_date": None,
            "ndvi_trend_per_year": None,
            "recent_vs_baseline_anomaly": None,
            "monthly_climatology": [],
            "series": valid_modis,
        }

    ndvis = np.array([float(r["ndvi"]) for r in active_recs], dtype=float)
    evis = np.array([float(r["evi"]) for r in active_recs if r.get("evi") is not None], dtype=float)

    # Convert dates to fractional years for deterministic linear slope
    import datetime as dt
    years_x = []
    for r in active_recs:
        d = dt.date.fromisoformat(r["date"])
        years_x.append(d.year + (d.timetuple().tm_yday / 365.25))
    x_arr = np.array(years_x, dtype=float)
    slope_per_year = 0.0
    if len(x_arr) >= 6 and (x_arr.max() - x_arr.min()) >= 0.4:
        slope_per_year = float(np.polyfit(x_arr, ndvis, 1)[0])

    # Baseline vs recent 6 valid composites
    recent_slice = ndvis[-min(6, len(ndvis)) :]
    baseline_mean = float(np.mean(ndvis))
    recent_mean = float(np.mean(recent_slice))
    anomaly = round(recent_mean - baseline_mean, 4)

    # Monthly average NDVI/EVI
    by_month: Dict[int, List[float]] = {m: [] for m in range(1, 13)}
    for r in active_recs:
        m = int(r["date"][5:7])
        by_month[m].append(float(r["ndvi"]))

    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_climatology = [
        {
            "month": m,
            "label": month_names[m - 1],
            "mean_ndvi": round(float(np.mean(by_month[m])), 4) if by_month[m] else None,
            "sample_count": len(by_month[m]),
        }
        for m in range(1, 13)
    ]

    return {
        "status": "available",
        "primary_source": primary_source,
        "valid_observations": len(active_recs),
        "total_modis_composites": len(modis_recs),
        "mean_ndvi": round(baseline_mean, 4),
        "mean_evi": round(float(np.mean(evis)), 4) if len(evis) else None,
        "latest_ndvi": round(float(ndvis[-1]), 4),
        "latest_evi": round(float(active_recs[-1]["evi"]), 4) if active_recs[-1].get("evi") is not None else None,
        "latest_date": active_recs[-1]["date"],
        "ndvi_trend_per_year": round(slope_per_year, 4),
        "recent_vs_baseline_anomaly": anomaly,
        "monthly_climatology": monthly_climatology,
        "series": valid_modis,
        "landsat_series": landsat_recs,
    }

