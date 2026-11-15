import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.analytics.climate import compute_climate_and_water_trends
from app.analytics.vegetation import analyze_vegetation_series
from app.analytics.vulnerability import compute_five_vulnerabilities
from app.database.session import get_db
from app.models.analysis import VulnerabilityAnalysisRecord
from app.models.farm import Farm
from app.models.report import DecisionReportRecord
from app.recommendations.scenarios import generate_rotation_scenarios
from app.recommendations.simulator import run_climate_simulation
from app.reports.pdf_generator import build_decision_report_pdf
from app.schemas.analysis import ClimateSimulationRequest, RotationScenariosRequest
from app.services.observation_service import gather_earth_observations, serialize_farm, serialize_soil

router = APIRouter(prefix="/api/farms", tags=["Vulnerability, Rotation & Decision Reports"])


@router.get("/{farm_id}/analyse")
def get_latest_analysis(farm_id: str, db: Session = Depends(get_db)):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")
    latest = (
        db.query(VulnerabilityAnalysisRecord)
        .filter(VulnerabilityAnalysisRecord.farm_id == farm_id)
        .order_by(VulnerabilityAnalysisRecord.created_at.desc())
        .first()
    )
    if not latest:
        return {"status": "not_run", "farm_id": farm_id, "analysis": None}
    return {"status": "available", "farm_id": farm_id, "created_at": latest.created_at, **latest.result_json}


@router.post("/{farm_id}/analyse")
async def run_farm_analysis(farm_id: str, db: Session = Depends(get_db)):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")

    obs = await gather_earth_observations(db, farm)
    climate = compute_climate_and_water_trends(obs["power"])
    vegetation = analyze_vegetation_series(obs["modis"], obs["gee"])

    farm_dict = serialize_farm(farm)
    soil_dict = serialize_soil(farm.soil_profile)
    srtm_summary = obs["srtm"].get("summary") or {}

    vuln = compute_five_vulnerabilities(
        farm=farm_dict,
        soil=soil_dict,
        climate_trends=climate,
        vegetation_analysis=vegetation,
        srtm_summary=srtm_summary,
    )

    result_payload = {
        "observation_period": obs["observation_period"],
        "vulnerabilities": vuln,
        "climate_summary": climate.get("summary", {}),
        "vegetation_summary": {
            "status": vegetation.get("status"),
            "primary_source": vegetation.get("primary_source"),
            "valid_observations": vegetation.get("valid_observations"),
            "mean_ndvi": vegetation.get("mean_ndvi"),
            "mean_evi": vegetation.get("mean_evi"),
            "latest_ndvi": vegetation.get("latest_ndvi"),
            "latest_date": vegetation.get("latest_date"),
            "ndvi_trend_per_year": vegetation.get("ndvi_trend_per_year"),
            "recent_vs_baseline_anomaly": vegetation.get("recent_vs_baseline_anomaly"),
        },
        "provenance": obs["provenance"],
    }

    rec = VulnerabilityAnalysisRecord(
        id=f"vuln-{uuid.uuid4().hex[:10]}",
        farm_id=farm.id,
        analysis_start_date=obs["observation_period"]["start"],
        analysis_end_date=obs["observation_period"]["end"],
        result_json=result_payload,
    )
    db.add(rec)
    db.commit()

    return {"status": "available", "farm_id": farm.id, "analysis_id": rec.id, **result_payload}


@router.post("/{farm_id}/rotation-scenarios")
async def evaluate_rotation_scenarios(
    farm_id: str,
    payload: RotationScenariosRequest | None = None,
    db: Session = Depends(get_db),
):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")

    obs = await gather_earth_observations(db, farm)
    climate = compute_climate_and_water_trends(obs["power"])

    farm_dict = serialize_farm(farm)
    soil_dict = serialize_soil(farm.soil_profile)
    weights_dict = payload.weights.model_dump() if (payload and payload.weights) else None
    constraints_override = payload.farmer_constraints if payload else None

    result = generate_rotation_scenarios(
        farm=farm_dict,
        soil=soil_dict,
        climate_trends=climate,
        custom_weights=weights_dict,
        farmer_constraints_override=constraints_override,
    )
    return result


@router.post("/{farm_id}/climate-simulation")
async def simulate_climate_what_if(
    farm_id: str,
    payload: ClimateSimulationRequest,
    db: Session = Depends(get_db),
):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")

    obs = await gather_earth_observations(db, farm)
    climate = compute_climate_and_water_trends(obs["power"])
    farm_dict = serialize_farm(farm)
    soil_dict = serialize_soil(farm.soil_profile)
    weights_dict = payload.weights.model_dump() if payload.weights else None

    return run_climate_simulation(
        farm=farm_dict,
        soil=soil_dict,
        climate_trends=climate,
        rainfall_delta_pct=payload.rainfall_delta_pct,
        temperature_delta_c=payload.temperature_delta_c,
        water_availability_delta_pct=payload.water_availability_delta_pct,
        season_shift_days=payload.season_shift_days,
        custom_weights=weights_dict,
    )


async def _build_report_bundle(db: Session, farm: Farm) -> dict:
    obs = await gather_earth_observations(db, farm)
    climate = compute_climate_and_water_trends(obs["power"])
    vegetation = analyze_vegetation_series(obs["modis"], obs["gee"])
    farm_dict = serialize_farm(farm)
    soil_dict = serialize_soil(farm.soil_profile)
    srtm_summary = obs["srtm"].get("summary") or {}

    vuln = compute_five_vulnerabilities(
        farm=farm_dict,
        soil=soil_dict,
        climate_trends=climate,
        vegetation_analysis=vegetation,
        srtm_summary=srtm_summary,
    )
    scenarios_bundle = generate_rotation_scenarios(
        farm=farm_dict,
        soil=soil_dict,
        climate_trends=climate,
    )
    return {
        "farm": farm_dict,
        "soil": soil_dict,
        "provenance": obs["provenance"],
        "climate_summary": climate.get("summary", {}),
        "vegetation_summary": {
            "status": vegetation.get("status"),
            "primary_source": vegetation.get("primary_source"),
            "valid_observations": vegetation.get("valid_observations"),
            "mean_ndvi": vegetation.get("mean_ndvi"),
            "mean_evi": vegetation.get("mean_evi"),
            "latest_ndvi": vegetation.get("latest_ndvi"),
            "latest_date": vegetation.get("latest_date"),
            "ndvi_trend_per_year": vegetation.get("ndvi_trend_per_year"),
            "recent_vs_baseline_anomaly": vegetation.get("recent_vs_baseline_anomaly"),
        },
        "vulnerabilities": vuln,
        "scenarios_bundle": scenarios_bundle,
    }


@router.get("/{farm_id}/decision-report/preview")
async def preview_decision_report(farm_id: str, db: Session = Depends(get_db)):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")
    return await _build_report_bundle(db, farm)


@router.get("/{farm_id}/decision-report")
async def download_decision_report(farm_id: str, db: Session = Depends(get_db)):
    farm = db.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail=f"Farm '{farm_id}' not found.")

    bundle = await _build_report_bundle(db, farm)
    pdf_bytes = build_decision_report_pdf(bundle)

    rec = DecisionReportRecord(
        id=f"rep-{uuid.uuid4().hex[:10]}",
        farm_id=farm.id,
        title=f"FIELDWISE AI Report - {farm.name}",
        metadata_json={"recommended": (bundle["scenarios_bundle"].get("recommended_strategy") or {}).get("name")},
    )
    db.add(rec)
    db.commit()

    safe_name = "".join(c if c.isalnum() or c in "-_" else "_" for c in farm.name).strip("_")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="FIELDWISE_Decision_Report_{safe_name}.pdf"',
            "Cache-Control": "no-store",
        },
    )

