from typing import Any, Dict, List


def evaluate_hard_constraints(
    strategy: Dict[str, Any],
    farm: Dict[str, Any],
    soil: Dict[str, Any],
    climate_context: Dict[str, Any],
    farmer_constraints: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Evaluate deterministic hard agronomic exclusions BEFORE multi-criteria scoring.
    Never silently assumes missing soil parameters pass; tracks unknown validation items.
    """
    exclusions: List[str] = []
    warnings: List[str] = []
    unknown_checks: List[str] = []

    farming_system = farm.get("farming_system", "conventional_rice_pulse")
    is_pokkali = farming_system == "pokkali_rice_prawn"

    ec = soil.get("ec_ds_m")
    ph = soil.get("ph")
    salinity_class = (soil.get("salinity_class") or "unknown").lower()
    waterlog = (soil.get("waterlogging_history") or "unknown").lower()
    drainage = (soil.get("drainage_class") or "unknown").lower()
    irrigation = (soil.get("irrigation_availability") or "unknown").lower()

    preserve_aqua = bool(farmer_constraints.get("preserve_aquaculture", is_pokkali))
    max_duration = farmer_constraints.get("max_duration_days")

    # 1. Pokkali / Flooded Saline Aquaculture Protection & Terrestrial Crop Exclusion
    if is_pokkali and strategy.get("is_terrestrial_dry_crop", False):
        exclusions.append(
            "Ecosystem & Livelihood Constraint: Pokkali coastal polder undergoes brackish tidal inundation (Nov–Apr); "
            "terrestrial dry-season crops cannot survive saline waterlogging without destroying traditional prawn aquaculture."
        )

    if preserve_aqua and not strategy.get("requires_aquaculture_preservation", False) and is_pokkali:
        exclusions.append(
            "Farmer Livelihood Constraint: Farmer profile mandates preserving seasonal brackish prawn aquaculture."
        )

    # 2. Salinity / Electrical Conductivity (EC)
    max_ec = float(strategy.get("salinity_tolerance_max_ec", 4.0))
    if ec is not None:
        if ec > max_ec:
            exclusions.append(
                f"Salinity Exclusion: Field EC ({ec:.2f} dS/m) exceeds strategy maximum tolerance ({max_ec:.1f} dS/m)."
            )
    elif salinity_class in ("high", "seasonal_brackish") and max_ec < 4.0:
        exclusions.append(
            f"Salinity Exclusion: Reported '{salinity_class}' salinity exceeds non-halophytic threshold ({max_ec:.1f} dS/m)."
        )
    elif ec is None and salinity_class == "unknown":
        unknown_checks.append("Soil EC / salinity not tested — salinity suitability requires local lab validation.")

    # 3. Soil pH
    min_ph = float(strategy.get("min_ph", 4.5))
    max_ph = float(strategy.get("max_ph", 8.5))
    if ph is not None:
        if ph < min_ph - 0.3 or ph > max_ph + 0.3:
            exclusions.append(
                f"Soil pH Exclusion: Field pH ({ph:.1f}) falls outside viable agronomic range ({min_ph:.1f}–{max_ph:.1f})."
            )
        elif ph < min_ph or ph > max_ph:
            warnings.append(
                f"Marginal Soil pH ({ph:.1f}): Requires targeted liming/gypsum amendment to reach {min_ph:.1f}–{max_ph:.1f}."
            )
    else:
        unknown_checks.append("Soil pH unknown — verify acidity/alkalinity before planting.")

    # 4. Waterlogging & Drainage
    if not strategy.get("submergence_suitable", False):
        if waterlog in ("seasonal_prolonged", "perennial") or drainage == "very_poorly_drained":
            exclusions.append(
                f"Waterlogging Exclusion: Strategy requires drained topsoil, incompatible with '{waterlog}' waterlogging / '{drainage}' drainage."
            )
        elif waterlog == "unknown" and drainage == "unknown":
            unknown_checks.append("Drainage and waterlogging history unknown — verify post-monsoon surface drainage.")

    # 5. Crop Duration & Calendar Shift
    eff_duration = int(strategy.get("duration_days", 120)) + abs(int(climate_context.get("season_shift_days", 0))) // 3
    if max_duration is not None and eff_duration > int(max_duration) + 15:
        exclusions.append(
            f"Duration Exclusion: Effective growing cycle ({eff_duration} days) exceeds farmer window limit ({max_duration} days)."
        )

    # 6. Temperature Ceiling
    peak_tmax = climate_context.get("mean_summer_tmax_c")
    strat_max_t = float(strategy.get("max_temp_c", 38.0))
    if peak_tmax is not None and peak_tmax > strat_max_t + 1.5:
        exclusions.append(
            f"Heat Ceiling Exclusion: Seasonal Tmax ({peak_tmax:.1f}°C) exceeds strategy thermal ceiling ({strat_max_t:.1f}°C)."
        )
    elif peak_tmax is not None and peak_tmax > strat_max_t:
        warnings.append(
            f"Thermal Stress Warning: Seasonal Tmax ({peak_tmax:.1f}°C) approaches upper limit ({strat_max_t:.1f}°C)."
        )

    # 7. Water Availability & Dry-Season Irrigation
    water_class = strategy.get("water_demand_class", "medium")
    water_delta = float(climate_context.get("water_availability_delta_pct", 0.0))
    deficit_months = climate_context.get("dry_season_deficit_months", 0)
    if water_class == "high_dry_season":
        if irrigation in ("none", "rainfed") or (water_delta <= -20.0 and irrigation != "canal"):
            exclusions.append(
                "Water Availability Exclusion: High dry-season irrigation demand is unsustainable under rainfed/water-scarce conditions."
            )
        elif deficit_months >= 4 and irrigation == "unknown":
            unknown_checks.append("Irrigation reliability unknown despite >=4 dry deficit months; high water demand carries elevated risk.")

    return {
        "eligible": len(exclusions) == 0,
        "excluded": len(exclusions) > 0,
        "exclusion_reasons": exclusions,
        "warnings": warnings,
        "unknown_checks": unknown_checks,
    }

