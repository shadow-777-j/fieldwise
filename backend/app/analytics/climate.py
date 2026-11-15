from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

SEASON_MAP = {
    6: "Kharif / Virippu (Jun-Oct)",
    7: "Kharif / Virippu (Jun-Oct)",
    8: "Kharif / Virippu (Jun-Oct)",
    9: "Kharif / Virippu (Jun-Oct)",
    10: "Kharif / Virippu (Jun-Oct)",
    11: "Rabi / Post-Monsoon (Nov-Feb)",
    12: "Rabi / Post-Monsoon (Nov-Feb)",
    1: "Rabi / Post-Monsoon (Nov-Feb)",
    2: "Rabi / Post-Monsoon (Nov-Feb)",
    3: "Summer / Pre-Monsoon (Mar-May)",
    4: "Summer / Pre-Monsoon (Mar-May)",
    5: "Summer / Pre-Monsoon (Mar-May)",
}

MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _safe_float(val: Any) -> Optional[float]:
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    return round(float(val), 3)


def compute_climate_and_water_trends(
    power_payload: Dict[str, Any],
    compare_year_a: Optional[int] = None,
    compare_year_b: Optional[int] = None,
) -> Dict[str, Any]:
    """Compute annual, monthly, and matching-season climate & partial water-balance indicators from NASA POWER."""
    records = power_payload.get("records") or []
    if not records:
        return {
            "status": "insufficient_data",
            "available_years": [],
            "annual_series": [],
            "monthly_series": [],
            "seasonal_series": [],
            "year_comparison": None,
            "summary": {},
        }

    df = pd.DataFrame(records)
    df["dt"] = pd.to_datetime(df["date"])
    df["year"] = df["dt"].dt.year
    df["month"] = df["dt"].dt.month
    df["season"] = df["month"].map(SEASON_MAP)
    # Agricultural season-year (Nov-Dec belong to post-monsoon cycle starting that Nov)
    df["season_year"] = np.where(df["month"].isin([1, 2]), df["year"] - 1, df["year"])

    available_years = sorted([int(y) for y in df["year"].unique()])

    # 1. Annual aggregation
    annual_rows: List[Dict[str, Any]] = []
    for yr, grp in df.groupby("year"):
        valid_precip = grp["precip_mm"].dropna()
        valid_t2m = grp["t2m"].dropna()
        valid_tmax = grp["t2m_max"].dropna()
        valid_gwet_top = grp["gwettop"].dropna()
        valid_gwet_root = grp["gwetroot"].dropna()
        valid_et = grp["et_mm"].dropna()

        annual_rain = float(valid_precip.sum()) if len(valid_precip) else None
        annual_et = float(valid_et.sum()) if len(valid_et) else None
        p_minus_et = (annual_rain - annual_et) if (annual_rain is not None and annual_et is not None) else None

        annual_rows.append(
            {
                "year": int(yr),
                "observation_days": int(len(grp)),
                "valid_precip_days": int(len(valid_precip)),
                "total_rainfall_mm": _safe_float(annual_rain),
                "mean_temp_c": _safe_float(valid_t2m.mean()) if len(valid_t2m) else None,
                "max_temp_c": _safe_float(valid_tmax.max()) if len(valid_tmax) else None,
                "mean_tmax_c": _safe_float(valid_tmax.mean()) if len(valid_tmax) else None,
                "heavy_rain_days_20mm": int((valid_precip >= 20.0).sum()),
                "extreme_rain_days_50mm": int((valid_precip >= 50.0).sum()),
                "heat_stress_days_34c": int((valid_tmax >= 34.0).sum()),
                "mean_gwettop": _safe_float(valid_gwet_top.mean()) if len(valid_gwet_top) else None,
                "mean_gwetroot": _safe_float(valid_gwet_root.mean()) if len(valid_gwet_root) else None,
                "partial_et_mm": _safe_float(annual_et),
                "partial_water_balance_mm": _safe_float(p_minus_et),
            }
        )

    # Multi-year baselines (only years with >= 300 valid days so partial current year doesn't skew baseline mean!)
    complete_years = [r for r in annual_rows if r["valid_precip_days"] >= 300 and r["total_rainfall_mm"] is not None]
    baseline_annual_rain = float(np.mean([r["total_rainfall_mm"] for r in complete_years])) if complete_years else None
    baseline_annual_temp = (
        float(np.mean([r["mean_temp_c"] for r in complete_years if r["mean_temp_c"] is not None]))
        if complete_years
        else None
    )

    for r in annual_rows:
        if r["valid_precip_days"] >= 300 and baseline_annual_rain is not None and r["total_rainfall_mm"] is not None:
            r["rainfall_anomaly_mm"] = round(r["total_rainfall_mm"] - baseline_annual_rain, 2)
        else:
            r["rainfall_anomaly_mm"] = None
        if baseline_annual_temp is not None and r["mean_temp_c"] is not None:
            r["temp_anomaly_c"] = round(r["mean_temp_c"] - baseline_annual_temp, 2)
        else:
            r["temp_anomaly_c"] = None

    # 2. Monthly aggregation + matching-month climatology for anomalies & standardized soil wetness anomaly
    monthly_grp = (
        df.groupby(["year", "month"], as_index=False)
        .agg(
            rainfall_mm=("precip_mm", "sum"),
            valid_precip_days=("precip_mm", "count"),
            mean_temp_c=("t2m", "mean"),
            max_temp_c=("t2m_max", "max"),
            mean_tmax_c=("t2m_max", "mean"),
            mean_gwettop=("gwettop", "mean"),
            mean_gwetroot=("gwetroot", "mean"),
            et_mm=("et_mm", "sum"),
            solar_mj_m2=("solar_mj_m2", "mean"),
        )
    )

    # Compute matching-month baseline mean & std
    m_rain_mean = monthly_grp.groupby("month")["rainfall_mm"].mean().to_dict()
    m_temp_mean = monthly_grp.groupby("month")["mean_temp_c"].mean().to_dict()
    m_gwet_mean = monthly_grp.groupby("month")["mean_gwetroot"].mean().to_dict()
    m_gwet_std = monthly_grp.groupby("month")["mean_gwetroot"].std(ddof=1).to_dict()

    monthly_series: List[Dict[str, Any]] = []
    for _, row in monthly_grp.iterrows():
        yr = int(row["year"])
        mo = int(row["month"])
        rain = float(row["rainfall_mm"]) if pd.notna(row["rainfall_mm"]) else None
        et = float(row["et_mm"]) if pd.notna(row["et_mm"]) else None
        p_et = (rain - et) if (rain is not None and et is not None) else None
        tmean = float(row["mean_temp_c"]) if pd.notna(row["mean_temp_c"]) else None
        groot = float(row["mean_gwetroot"]) if pd.notna(row["mean_gwetroot"]) else None
        gtop = float(row["mean_gwettop"]) if pd.notna(row["mean_gwettop"]) else None

        rain_anom = (rain - float(m_rain_mean[mo])) if (rain is not None and mo in m_rain_mean) else None
        temp_anom = (tmean - float(m_temp_mean[mo])) if (tmean is not None and mo in m_temp_mean) else None

        std_val = m_gwet_std.get(mo)
        if groot is not None and mo in m_gwet_mean and pd.notna(std_val) and float(std_val) > 1e-6:
            soil_std_anom = round((groot - float(m_gwet_mean[mo])) / float(std_val), 3)
        else:
            soil_std_anom = None

        monthly_series.append(
            {
                "year_month": f"{yr}-{mo:02d}",
                "year": yr,
                "month": mo,
                "month_label": MONTH_LABELS[mo - 1],
                "rainfall_mm": _safe_float(rain),
                "rainfall_anomaly_mm": _safe_float(rain_anom),
                "mean_temp_c": _safe_float(tmean),
                "max_temp_c": _safe_float(row["max_temp_c"]),
                "mean_tmax_c": _safe_float(row["mean_tmax_c"]),
                "temp_anomaly_c": _safe_float(temp_anom),
                "mean_gwettop": _safe_float(gtop),
                "mean_gwetroot": _safe_float(groot),
                "std_soil_moisture_anomaly": soil_std_anom,
                "partial_et_mm": _safe_float(et),
                "partial_water_balance_mm": _safe_float(p_et),
                "solar_mj_m2": _safe_float(row["solar_mj_m2"]),
            }
        )

    # 3. Seasonal aggregation (matching seasonal baseline)
    seas_grp = (
        df.groupby(["season_year", "season"], as_index=False)
        .agg(
            days=("precip_mm", "count"),
            rainfall_mm=("precip_mm", "sum"),
            mean_temp_c=("t2m", "mean"),
            mean_tmax_c=("t2m_max", "mean"),
            max_temp_c=("t2m_max", "max"),
            mean_gwetroot=("gwetroot", "mean"),
            et_mm=("et_mm", "sum"),
        )
    )
    # Require near-complete seasonal coverage (>= 75 days) for baseline stats
    complete_seas = seas_grp[seas_grp["days"] >= 75]
    s_rain_mean = complete_seas.groupby("season")["rainfall_mm"].mean().to_dict()
    s_temp_mean = complete_seas.groupby("season")["mean_temp_c"].mean().to_dict()
    s_gwet_mean = complete_seas.groupby("season")["mean_gwetroot"].mean().to_dict()
    s_gwet_std = complete_seas.groupby("season")["mean_gwetroot"].std(ddof=1).to_dict()

    seasonal_series: List[Dict[str, Any]] = []
    for _, row in seas_grp.iterrows():
        syear = int(row["season_year"])
        sname = str(row["season"])
        if int(row["days"]) < 30:
            continue
        rain = float(row["rainfall_mm"])
        et = float(row["et_mm"]) if pd.notna(row["et_mm"]) else None
        tmean = float(row["mean_temp_c"]) if pd.notna(row["mean_temp_c"]) else None
        groot = float(row["mean_gwetroot"]) if pd.notna(row["mean_gwetroot"]) else None
        rain_anom = (rain - float(s_rain_mean[sname])) if sname in s_rain_mean and int(row["days"]) >= 75 else None
        temp_anom = (tmean - float(s_temp_mean[sname])) if (tmean is not None and sname in s_temp_mean) else None
        s_std = s_gwet_std.get(sname)
        soil_z = (
            round((groot - float(s_gwet_mean[sname])) / float(s_std), 3)
            if (groot is not None and sname in s_gwet_mean and pd.notna(s_std) and float(s_std) > 1e-6)
            else None
        )
        seasonal_series.append(
            {
                "season_year": syear,
                "season": sname,
                "days": int(row["days"]),
                "rainfall_mm": _safe_float(rain),
                "rainfall_anomaly_mm": _safe_float(rain_anom),
                "mean_temp_c": _safe_float(tmean),
                "mean_tmax_c": _safe_float(row["mean_tmax_c"]),
                "max_temp_c": _safe_float(row["max_temp_c"]),
                "temp_anomaly_c": _safe_float(temp_anom),
                "mean_gwetroot": _safe_float(groot),
                "std_soil_moisture_anomaly": soil_z,
                "partial_et_mm": _safe_float(et),
                "partial_water_balance_mm": _safe_float(rain - et) if et is not None else None,
            }
        )

    # 4. Year-over-Year Monthly Comparison
    if len(available_years) >= 2:
        yr_a = compare_year_a if compare_year_a in available_years else available_years[-2]
        yr_b = compare_year_b if compare_year_b in available_years else available_years[-1]
    elif len(available_years) == 1:
        yr_a = yr_b = available_years[0]
    else:
        yr_a = yr_b = None

    year_comparison = None
    if yr_a is not None and yr_b is not None:
        map_a = {r["month"]: r for r in monthly_series if r["year"] == yr_a}
        map_b = {r["month"]: r for r in monthly_series if r["year"] == yr_b}
        comp_months = []
        for m in range(1, 13):
            ra = map_a.get(m, {})
            rb = map_b.get(m, {})
            comp_months.append(
                {
                    "month": m,
                    "month_label": MONTH_LABELS[m - 1],
                    "baseline_rainfall_mm": _safe_float(m_rain_mean.get(m)),
                    "year_a_rainfall_mm": ra.get("rainfall_mm"),
                    "year_b_rainfall_mm": rb.get("rainfall_mm"),
                    "year_a_temp_c": ra.get("mean_temp_c"),
                    "year_b_temp_c": rb.get("mean_temp_c"),
                    "year_a_gwetroot": ra.get("mean_gwetroot"),
                    "year_b_gwetroot": rb.get("mean_gwetroot"),
                }
            )
        year_comparison = {"year_a": yr_a, "year_b": yr_b, "months": comp_months}

    latest_complete = complete_years[-1] if complete_years else (annual_rows[-1] if annual_rows else {})
    recent_monthly = monthly_series[-12:] if monthly_series else []

    return {
        "status": "available",
        "available_years": available_years,
        "baseline_annual_rainfall_mm": _safe_float(baseline_annual_rain),
        "baseline_annual_temp_c": _safe_float(baseline_annual_temp),
        "annual_series": annual_rows,
        "monthly_series": monthly_series,
        "seasonal_series": seasonal_series,
        "year_comparison": year_comparison,
        "water_balance_note": (
            "Partial atmospheric water-balance indicator computed as NASA POWER Precipitation minus "
            "MERRA-2 Evapotranspiration Energy Flux converted via latent heat (2.45 MJ/kg). "
            "Not a complete hydrological, irrigation, or tidal groundwater model."
        ),
        "summary": {
            "latest_complete_year": latest_complete.get("year"),
            "latest_complete_rainfall_mm": latest_complete.get("total_rainfall_mm"),
            "latest_rainfall_anomaly_mm": latest_complete.get("rainfall_anomaly_mm"),
            "latest_temp_anomaly_c": latest_complete.get("temp_anomaly_c"),
            "latest_mean_gwetroot": recent_monthly[-1].get("mean_gwetroot") if recent_monthly else None,
            "latest_std_soil_anomaly": recent_monthly[-1].get("std_soil_moisture_anomaly") if recent_monthly else None,
            "mean_extreme_rain_days_50mm_per_yr": _safe_float(
                np.mean([r["extreme_rain_days_50mm"] for r in complete_years])
            )
            if complete_years
            else None,
            "mean_heat_stress_days_34c_per_yr": _safe_float(
                np.mean([r["heat_stress_days_34c"] for r in complete_years])
            )
            if complete_years
            else None,
            "dry_season_deficit_months_last_12m": sum(
                1 for r in recent_monthly if (r.get("partial_water_balance_mm") or 0) < 0
            ),
        },
    }

