import os
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on path
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Use isolated test DB
os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_DIR / 'test_fieldwise.db'}"

from app.analytics.vegetation import compute_evi, compute_ndvi  # noqa: E402
from app.analytics.vulnerability import compute_five_vulnerabilities  # noqa: E402
from app.database.init_db import init_db  # noqa: E402
from app.database.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.recommendations.scenarios import generate_rotation_scenarios  # noqa: E402
from app.services.geometry import compute_geodesic_metrics, extract_polygon_geometry  # noqa: E402


@pytest.fixture(scope="module")
def client():
    db_file = BACKEND_DIR / "test_fieldwise.db"
    if db_file.exists():
        db_file.unlink()
    init_db()
    with TestClient(app) as c:
        yield c
    engine.dispose()
    if db_file.exists():
        db_file.unlink()


def test_vegetation_indices_formulas():
    # Standard NIR=0.45, Red=0.10, Blue=0.05
    ndvi = compute_ndvi(0.45, 0.10)
    evi = compute_evi(0.45, 0.10, 0.05)
    assert ndvi == pytest.approx((0.45 - 0.10) / (0.45 + 0.10), abs=1e-4)
    assert evi == pytest.approx(2.5 * (0.45 - 0.10) / (0.45 + 6 * 0.10 - 7.5 * 0.05 + 1.0), abs=1e-4)
    assert compute_ndvi(0.0, 0.0) is None


def test_geodesic_area_and_geojson_feature_collection():
    fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "Test Plot"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[76.28, 9.877], [76.282, 9.877], [76.282, 9.879], [76.28, 9.879], [76.28, 9.877]]],
                },
            }
        ],
    }
    geom = extract_polygon_geometry(fc)
    assert geom["type"] == "Polygon"
    wkt, lat, lon, area_ha, perim = compute_geodesic_metrics(geom)
    assert 4.0 < area_ha < 6.0  # ~0.002 deg x 0.002 deg near 10N is ~4.8 ha
    assert perim > 800
    assert 9.87 < lat < 9.88
    assert 76.28 < lon < 76.29


def test_missing_soil_data_does_not_fabricate_soil_risk():
    vuln = compute_five_vulnerabilities(
        farm={"farming_system": "conventional_rice_pulse", "elevation_m": 50.0},
        soil=None,
        climate_trends={"status": "insufficient_data", "monthly_series": [], "annual_series": [], "seasonal_series": []},
        vegetation_analysis={"status": "insufficient_data", "valid_observations": 2},
    )
    assert len(vuln["indicators"]) == 5
    for ind in vuln["indicators"]:
        assert ind["category"] == "Insufficient Data"
        assert ind["index_score"] is None
        assert ind["confidence"] == "Insufficient Data"


def test_pokkali_constraints_exclude_terrestrial_pulse_even_with_max_preference():
    pokkali_farm = {"id": "f1", "farming_system": "pokkali_rice_prawn"}
    pokkali_soil = {
        "ph": 5.6,
        "ec_ds_m": 4.8,
        "salinity_class": "seasonal_brackish",
        "waterlogging_history": "seasonal_prolonged",
        "drainage_class": "poorly_drained",
        "irrigation_availability": "tidal_sluice",
        "farmer_constraints": {"preserve_aquaculture": True},
    }
    # Even if farmer sets farmer_preference to 100%, hard agronomic constraints cannot be overridden
    res = generate_rotation_scenarios(
        farm=pokkali_farm,
        soil=pokkali_soil,
        climate_trends={"annual_series": [], "summary": {}},
        custom_weights={"farmer_preference": 100.0, "water_sustainability": 0.0, "soil_improvement": 0.0, "climate_resilience": 0.0, "economic_potential": 0.0, "erosion_protection": 0.0},
    )
    assert res["eligible_count"] == 3
    excluded = [s for s in res["scenarios"] if not s["eligible"]]
    assert len(excluded) == 1
    assert "Pulse" in excluded[0]["name"]
    assert excluded[0]["final_score"] is None
    assert len(excluded[0]["exclusion_reasons"]) >= 1


def test_api_crud_and_live_nasa_pipeline(client: TestClient):
    # 1. Health & System Status
    sys_resp = client.get("/api/system/status")
    assert sys_resp.status_code == 200
    assert "google_earth_engine" in sys_resp.json()["data_services"]

    # 2. Demo farms exist
    farms_resp = client.get("/api/farms")
    assert farms_resp.status_code == 200
    farms = farms_resp.json()
    assert len(farms) >= 2
    pokkali = next(f for f in farms if f["id"] == "demo-pokkali-kumbalangi")
    assert pokkali["data_origin"] == "illustrative_demo"

    # 3. Create user farm + soil profile with unknown values
    create_resp = client.post(
        "/api/farms",
        json={
            "name": "Test Thrissur Kole Plot",
            "region": "Thrissur, Kerala, India",
            "farming_system": "conventional_rice_pulse",
            "geometry_geojson": {
                "type": "Polygon",
                "coordinates": [[[76.20, 10.50], [76.202, 10.50], [76.202, 10.502], [76.20, 10.502], [76.20, 10.50]]],
            },
            "analysis_start_date": "2023-01-01",
            "analysis_end_date": "2026-10-31",
        },
    )
    assert create_resp.status_code == 201
    new_farm_id = create_resp.json()["id"]

    soil_resp = client.post(
        f"/api/farms/{new_farm_id}/soil-profile",
        json={"ph": 6.4, "ec_ds_m": 0.5, "organic_carbon_pct": 0.85, "salinity_class": "low", "irrigation_availability": "canal"},
    )
    assert soil_resp.status_code == 200
    assert soil_resp.json()["data_origin"] == "user_entered"
    assert len(soil_resp.json()["missing_parameters"]) > 0

    # 4. Live NASA Earth Observations + Climate Trends + Vulnerability + Rotation + Simulator + PDF on Pokkali demo
    obs_resp = client.get("/api/farms/demo-pokkali-kumbalangi/earth-observations")
    assert obs_resp.status_code == 200
    obs_data = obs_resp.json()
    assert obs_data["power_summary"]["status"] == "available"
    assert obs_data["modis"]["status"] == "available"
    assert obs_data["modis"]["summary"]["qa_valid_composites"] >= 8
    assert obs_data["modis"]["summary"]["latest_valid_ndvi"] is not None
    assert obs_data["modis"]["vegetation_analysis"]["status"] == "available"
    assert len(obs_data["gibs_layers"]) >= 5

    trends_resp = client.get("/api/farms/demo-pokkali-kumbalangi/climate-trends")
    assert trends_resp.status_code == 200
    assert trends_resp.json()["climate"]["status"] == "available"
    assert len(trends_resp.json()["climate"]["annual_series"]) >= 5

    vuln_resp = client.post("/api/farms/demo-pokkali-kumbalangi/analyse")
    assert vuln_resp.status_code == 200
    indicators = vuln_resp.json()["vulnerabilities"]["indicators"]
    assert len(indicators) == 5
    for ind in indicators:
        assert ind["category"] != "Insufficient Data"
        assert ind["index_score"] is not None

    rot_resp = client.post("/api/farms/demo-pokkali-kumbalangi/rotation-scenarios", json={})
    assert rot_resp.status_code == 200
    assert rot_resp.json()["eligible_count"] >= 3

    sim_resp = client.post(
        "/api/farms/demo-pokkali-kumbalangi/climate-simulation",
        json={"rainfall_delta_pct": -15, "temperature_delta_c": 2.0, "water_availability_delta_pct": -20, "season_shift_days": 15},
    )
    assert sim_resp.status_code == 200
    assert sim_resp.json()["is_hypothetical"] is True
    assert "NOT AN OFFICIAL NASA CLIMATE FORECAST" in sim_resp.json()["disclaimer"]

    pdf_resp = client.get("/api/farms/demo-pokkali-kumbalangi/decision-report")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content[:4] == b"%PDF"
    assert len(pdf_resp.content) > 4000

    # Clean up created test farm
    del_resp = client.delete(f"/api/farms/{new_farm_id}")
    assert del_resp.status_code == 204

