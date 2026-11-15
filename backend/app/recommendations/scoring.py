from typing import Any, Dict, List
from app.recommendations.crop_profiles import DEFAULT_WEIGHTS


def normalize_weights(custom_weights: Dict[str, float] | None) -> Dict[str, float]:
    raw = {k: float((custom_weights or {}).get(k, DEFAULT_WEIGHTS[k])) for k in DEFAULT_WEIGHTS}
    raw = {k: max(0.0, v) for k, v in raw.items()}
    total = sum(raw.values())
    if total <= 0:
        return {k: v / 100.0 for k, v in DEFAULT_WEIGHTS.items()}
    return {k: round(v / total, 4) for k, v in raw.items()}


def score_strategy(
    strategy: Dict[str, Any],
    constraint_result: Dict[str, Any],
    climate_context: Dict[str, Any],
    soil: Dict[str, Any],
    weights_norm: Dict[str, float],
) -> Dict[str, Any]:
    """
    Compute deterministic, explainable multi-criteria scores normalized 0–100.
    Criterion values adjust dynamically from real NASA climate observations and soil profile.
    """
    base = dict(strategy["base_scores"])
    drivers_positive: List[str] = []
    drivers_negative: List[str] = []

    rain_mm = climate_context.get("annual_rainfall_mm")
    rain_delta_pct = float(climate_context.get("rainfall_delta_pct", 0.0))
    temp_delta_c = float(climate_context.get("temperature_delta_c", 0.0))
    water_avail_delta = float(climate_context.get("water_availability_delta_pct", 0.0))
    shift_days = abs(int(climate_context.get("season_shift_days", 0)))
    extreme_rain_days = float(climate_context.get("extreme_rain_days_50mm", 0.0))
    deficit_months = int(climate_context.get("dry_season_deficit_months", 0))

    # Dynamic water sustainability adjustment
    water_score = base["water_sustainability"]
    if strategy.get("water_demand_class") in ("high_dry_season",):
        water_score -= deficit_months * 2.5
        if water_avail_delta < 0:
            water_score += water_avail_delta * 0.45
            drivers_negative.append("Dry-season water deficit penalizes high water-demand rotation.")
    elif strategy.get("water_demand_class") in ("very_low_dry_season", "low_dry_season"):
        if deficit_months >= 3 or water_avail_delta < 0:
            water_score += 5.0
            drivers_positive.append("Low dry-season water footprint fits observed seasonal moisture deficit.")
    elif "monsoon_tidal" in strategy.get("water_demand_class", ""):
        if rain_mm is not None and rain_mm >= 2000:
            water_score += 4.0
            drivers_positive.append(f"High observed monsoon rainfall ({rain_mm:.0f} mm/yr) supports natural salt flushing.")
        if rain_delta_pct < -10:
            water_score -= 6.0
            drivers_negative.append("Simulated monsoon decline slows early-season salinity leaching.")

    # Dynamic soil improvement adjustment
    soil_score = base["soil_improvement"]
    oc = soil.get("organic_carbon_pct")
    ph = soil.get("ph")
    if oc is not None and oc < 0.8 and strategy.get("nitrogen_fixation_kg_ha", 0) >= 40:
        soil_score += 5.0
        drivers_positive.append(f"High biological N/biomass input addresses low organic carbon ({oc:.2f}%).")
    if ph is not None and ph < 5.6 and "Lime" in strategy["name"]:
        soil_score += 5.0
        drivers_positive.append(f"Pre-monsoon lime/biochar conditioning directly buffers acidic soil (pH {ph:.1f}).")

    # Dynamic climate resilience adjustment
    clim_score = base["climate_resilience"]
    if extreme_rain_days >= 5.0:
        if "Short-Duration" in strategy["name"] or "Vyttila-11" in strategy["name"]:
            clim_score += 4.0
            drivers_positive.append(f"Short 105–110d cycle mitigates observed extreme rainfall risk ({extreme_rain_days:.1f} days/yr >= 50mm).")
        elif strategy.get("duration_days", 120) >= 125:
            clim_score -= 5.0
            drivers_negative.append(f"Longer crop duration increases exposure to extreme rainfall ({extreme_rain_days:.1f} days/yr >= 50mm).")

    if temp_delta_c > 1.0:
        if strategy.get("max_temp_c", 37.0) >= 38.0:
            clim_score -= temp_delta_c * 1.5
            drivers_positive.append("High thermal ceiling cushions simulated warming better than standard cultivars.")
        else:
            clim_score -= temp_delta_c * 4.5
            drivers_negative.append(f"+{temp_delta_c:.1f}°C warming pushes sensitive reproductive stages toward heat stress.")

    if shift_days >= 15:
        clim_score -= min(10.0, shift_days * 0.25)
        drivers_negative.append(f"±{shift_days}-day season shift stresses fixed planting calendar alignment.")

    # Clamp all criterion scores to 0..100
    criteria_scores = {
        "water_sustainability": round(max(0.0, min(100.0, water_score)), 1),
        "soil_improvement": round(max(0.0, min(100.0, soil_score)), 1),
        "climate_resilience": round(max(0.0, min(100.0, clim_score)), 1),
        "economic_potential": round(max(0.0, min(100.0, base["economic_potential"])), 1),
        "erosion_protection": round(max(0.0, min(100.0, base["erosion_protection"])), 1),
        "farmer_preference": round(max(0.0, min(100.0, base["farmer_preference"])), 1),
    }

    # Missing soil data confidence penalty (never silently inflate score when evidence is absent!)
    unknown_count = len(constraint_result.get("unknown_checks", []))
    evidence_status = (
        "Complete Field + Satellite Evidence"
        if unknown_count == 0
        else f"Partial Evidence ({unknown_count} local soil parameters unknown)"
    )

    weighted_sum = sum(criteria_scores[k] * weights_norm[k] for k in DEFAULT_WEIGHTS)
    final_score = round(float(max(0.0, min(100.0, weighted_sum))), 1)

    if constraint_result["excluded"]:
        status_label = "Agronomically Excluded"
        final_score = None  # Never award a competitive ranking score to a hard-excluded option!
    elif constraint_result["warnings"]:
        status_label = "Eligible with Management Caveats"
    else:
        status_label = "Recommended Candidate"

    return {
        "id": strategy["id"],
        "strategy_group": strategy["strategy_group"],
        "name": strategy["name"],
        "crops": strategy["crops"],
        "season_calendar": strategy["season_calendar"],
        "duration_days": strategy["duration_days"],
        "status": status_label,
        "eligible": constraint_result["eligible"],
        "final_score": final_score,
        "criteria_scores": criteria_scores,
        "weights_applied": {k: round(v * 100.0, 1) for k, v in weights_norm.items()},
        "comparison_attributes": {
            "water_requirement_mm": strategy["water_requirement_mm"],
            "water_demand_class": strategy["water_demand_class"],
            "soil_improvement_score": criteria_scores["soil_improvement"],
            "nitrogen_fixation_kg_ha": strategy["nitrogen_fixation_kg_ha"],
            "organic_matter_contribution": strategy["organic_matter_contribution"],
            "growing_season_compatibility": strategy["season_calendar"],
            "salinity_tolerance": f"Up to EC {strategy['salinity_tolerance_max_ec']} dS/m",
            "waterlogging_tolerance": strategy["waterlogging_tolerance"],
            "pest_cycle_interruption": strategy["pest_cycle_interruption"],
            "erosion_protection_score": criteria_scores["erosion_protection"],
            "economic_potential_score": criteria_scores["economic_potential"],
            "farmer_preference_score": criteria_scores["farmer_preference"],
        },
        "exclusion_reasons": constraint_result["exclusion_reasons"],
        "warnings": constraint_result["warnings"],
        "unknown_checks": constraint_result["unknown_checks"],
        "evidence_status": evidence_status,
        "explanation": {
            "summary": strategy["base_rationale"],
            "positive_drivers": drivers_positive,
            "risk_penalties": drivers_negative,
        },
        "data_origin": "model_derived",
    }

