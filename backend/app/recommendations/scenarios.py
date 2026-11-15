from typing import Any, Dict, List
from app.recommendations.constraints import evaluate_hard_constraints
from app.recommendations.crop_profiles import STRATEGY_CATALOG
from app.recommendations.scoring import normalize_weights, score_strategy


def build_climate_context(
    climate_trends: Dict[str, Any],
    rainfall_delta_pct: float = 0.0,
    temperature_delta_c: float = 0.0,
    water_availability_delta_pct: float = 0.0,
    season_shift_days: int = 0,
) -> Dict[str, Any]:
    annual = climate_trends.get("annual_series") or []
    complete_annual = [a for a in annual if (a.get("valid_precip_days") or 0) >= 300]
    target = complete_annual if complete_annual else annual
    summary = climate_trends.get("summary") or {}

    base_rain = (
        sum(a["total_rainfall_mm"] for a in target if a.get("total_rainfall_mm") is not None) / max(1, len(target))
        if target
        else None
    )
    base_tmax = (
        max((a["mean_tmax_c"] or 31.0) for a in target)
        if target
        else None
    )
    base_extreme = summary.get("mean_extreme_rain_days_50mm_per_yr") or 0.0
    base_deficit_months = int(summary.get("dry_season_deficit_months_last_12m") or 0)

    sim_rain = base_rain * (1.0 + rainfall_delta_pct / 100.0) if base_rain is not None else None
    sim_tmax = base_tmax + temperature_delta_c if base_tmax is not None else None
    sim_deficit = max(0, min(12, round(base_deficit_months * (1.0 - water_availability_delta_pct / 100.0))))

    return {
        "annual_rainfall_mm": round(sim_rain, 1) if sim_rain is not None else None,
        "mean_summer_tmax_c": round(sim_tmax, 2) if sim_tmax is not None else None,
        "extreme_rain_days_50mm": round(base_extreme * (1.0 + max(0.0, rainfall_delta_pct) / 80.0), 1),
        "dry_season_deficit_months": sim_deficit,
        "rainfall_delta_pct": rainfall_delta_pct,
        "temperature_delta_c": temperature_delta_c,
        "water_availability_delta_pct": water_availability_delta_pct,
        "season_shift_days": season_shift_days,
    }


def generate_rotation_scenarios(
    farm: Dict[str, Any],
    soil: Dict[str, Any] | None,
    climate_trends: Dict[str, Any],
    custom_weights: Dict[str, float] | None = None,
    farmer_constraints_override: Dict[str, Any] | None = None,
    climate_perturbations: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    soil = soil or {}
    farmer_constraints = dict(soil.get("farmer_constraints") or {})
    if farmer_constraints_override:
        farmer_constraints.update(farmer_constraints_override)

    pert = climate_perturbations or {}
    climate_context = build_climate_context(
        climate_trends,
        rainfall_delta_pct=float(pert.get("rainfall_delta_pct", 0.0)),
        temperature_delta_c=float(pert.get("temperature_delta_c", 0.0)),
        water_availability_delta_pct=float(pert.get("water_availability_delta_pct", 0.0)),
        season_shift_days=int(pert.get("season_shift_days", 0)),
    )

    weights_norm = normalize_weights(custom_weights)
    farming_system = farm.get("farming_system", "conventional_rice_pulse")

    # Select system-appropriate strategies + candidate options for transparent constraint testing
    candidates = [
        s for s in STRATEGY_CATALOG
        if farming_system in s["system_families"] or s["id"] == "upland_pulse_in_polder_candidate"
    ]
    # Keep Pokkali candidates cleanly aligned: only show upland_pulse_in_polder_candidate as excluded demo on Pokkali,
    # whereas on conventional systems it acts as Strategy B (Soil Improvement)!
    evaluated: List[Dict[str, Any]] = []
    for strat in candidates:
        strat_copy = dict(strat)
        if strat["id"] == "upland_pulse_in_polder_candidate" and farming_system != "pokkali_rice_prawn":
            strat_copy["strategy_group"] = "B · Soil Improvement Strategy"
        c_res = evaluate_hard_constraints(strat_copy, farm, soil, climate_context, farmer_constraints)
        scored = score_strategy(strat_copy, c_res, climate_context, soil, weights_norm)
        evaluated.append(scored)

    eligible_list = sorted(
        [e for e in evaluated if e["eligible"] and e["final_score"] is not None],
        key=lambda x: x["final_score"],
        reverse=True,
    )
    excluded_list = [e for e in evaluated if not e["eligible"]]

    top_rec = eligible_list[0] if eligible_list else None

    return {
        "farm_id": farm["id"],
        "farming_system": farming_system,
        "weights_normalized_pct": {k: round(v * 100.0, 1) for k, v in weights_norm.items()},
        "climate_context": climate_context,
        "recommended_strategy": top_rec,
        "scenarios": eligible_list + excluded_list,
        "eligible_count": len(eligible_list),
        "excluded_count": len(excluded_list),
        "formula": "Final Score = Sum(Criterion Score_i * Criterion Weight_i), normalized 0-100; Hard exclusions applied before scoring.",
        "data_origin": "model_derived",
    }

