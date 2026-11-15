from typing import Any, Dict
from app.recommendations.scenarios import generate_rotation_scenarios


def run_climate_simulation(
    farm: Dict[str, Any],
    soil: Dict[str, Any] | None,
    climate_trends: Dict[str, Any],
    rainfall_delta_pct: float,
    temperature_delta_c: float,
    water_availability_delta_pct: float,
    season_shift_days: int,
    custom_weights: Dict[str, float] | None = None,
) -> Dict[str, Any]:
    """Compare baseline deterministic rankings against user-defined hypothetical what-if perturbations."""
    baseline = generate_rotation_scenarios(
        farm=farm,
        soil=soil,
        climate_trends=climate_trends,
        custom_weights=custom_weights,
    )
    simulated = generate_rotation_scenarios(
        farm=farm,
        soil=soil,
        climate_trends=climate_trends,
        custom_weights=custom_weights,
        climate_perturbations={
            "rainfall_delta_pct": rainfall_delta_pct,
            "temperature_delta_c": temperature_delta_c,
            "water_availability_delta_pct": water_availability_delta_pct,
            "season_shift_days": season_shift_days,
        },
    )

    base_map = {s["id"]: s for s in baseline["scenarios"]}
    comparisons = []
    for sim_s in simulated["scenarios"]:
        base_s = base_map.get(sim_s["id"], {})
        b_score = base_s.get("final_score")
        s_score = sim_s.get("final_score")
        delta = round(s_score - b_score, 1) if (b_score is not None and s_score is not None) else None
        comparisons.append(
            {
                **sim_s,
                "baseline_score": b_score,
                "score_delta": delta,
                "baseline_eligible": base_s.get("eligible"),
            }
        )

    return {
        "is_hypothetical": True,
        "disclaimer": (
            "USER-DEFINED HYPOTHETICAL SCENARIO — NOT AN OFFICIAL NASA CLIMATE FORECAST. "
            "Results illustrate agronomic sensitivity to user-selected parameter shifts."
        ),
        "perturbations": {
            "rainfall_delta_pct": rainfall_delta_pct,
            "temperature_delta_c": temperature_delta_c,
            "water_availability_delta_pct": water_availability_delta_pct,
            "season_shift_days": season_shift_days,
        },
        "baseline_top_strategy": baseline.get("recommended_strategy"),
        "simulated_top_strategy": simulated.get("recommended_strategy"),
        "scenarios": comparisons,
        "climate_context": simulated["climate_context"],
        "data_origin": "hypothetical_simulation",
    }

