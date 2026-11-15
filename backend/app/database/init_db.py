from app.database.session import Base, SessionLocal, engine, ensure_postgis_if_postgres
from app.models import Farm, SoilProfile
from app.services.geometry import compute_geodesic_metrics, extract_polygon_geometry


DEMO_FARMS = [
    {
        "id": "demo-pokkali-kumbalangi",
        "name": "Kumbalangi North Pokkali Polder (Demo)",
        "region": "Kumbalangi, Ernakulam, Kerala, India",
        "farming_system": "pokkali_rice_prawn",
        "geometry_geojson": {
            "type": "Polygon",
            "coordinates": [
                [
                    [76.2843, 9.8749],
                    [76.2861, 9.8749],
                    [76.2862, 9.8766],
                    [76.2844, 9.8767],
                    [76.2843, 9.8749],
                ]
            ],
        },
        "elevation_m": None,
        "analysis_start_date": "2018-01-01",
        "analysis_end_date": "2026-10-31",
        "is_demo": True,
        "data_origin": "illustrative_demo",
        "notes": (
            "Primary demonstration farm representing traditional coastal Pokkali tidal rice-prawn farming "
            "in Kumbalangi, Ernakulam, Kerala. Rice (Jun-mid Oct) utilizes monsoon freshwater flushing; "
            "brackish prawn filtration (Nov-Apr) follows saline tidal inflow. Reference: ICAR JoSSWQ (2022)."
        ),
        "soil": {
            "id": "soil-demo-pokkali-kumbalangi",
            "ph": 5.6,
            "ec_ds_m": 4.8,
            "organic_carbon_pct": 1.65,
            "nitrogen_kg_ha": 245.0,
            "phosphorus_kg_ha": 18.5,
            "potassium_kg_ha": 195.0,
            "soil_texture": "silty_clay",
            "field_soil_moisture_pct": 46.0,
            "salinity_class": "seasonal_brackish",
            "irrigation_availability": "tidal_sluice",
            "drainage_class": "poorly_drained",
            "waterlogging_history": "seasonal_prolonged",
            "farmer_constraints": {
                "preserve_aquaculture": True,
                "max_water_demand": "high",
                "prefer_nitrogen_fixer": False,
                "max_duration_days": 140,
                "labor_availability": "moderate",
                "notes": "Traditional Pokkali rice-prawn cycle depends on Nov-Apr brackish prawn harvest income.",
            },
            "crop_history": [
                {
                    "year": 2024,
                    "season": "Virippu / Kharif (Jun-Oct)",
                    "crop": "Pokkali Rice (Vyttila-11 / Traditional)",
                    "status": "Harvested",
                    "origin": "illustrative_demo",
                },
                {
                    "year": 2024,
                    "season": "Post-Monsoon / Chemmeen Kettu (Nov-Apr)",
                    "crop": "Traditional Brackish Prawn Filtration (Penaeus indicus / Metapenaeus dobsoni)",
                    "status": "Active Seasonal Aquaculture",
                    "origin": "illustrative_demo",
                },
                {
                    "year": 2025,
                    "season": "Virippu / Kharif (Jun-Oct)",
                    "crop": "Pokkali Rice (Salt-tolerant tall cultivar)",
                    "status": "Harvested",
                    "origin": "illustrative_demo",
                },
            ],
            "data_origin": "illustrative_demo",
            "lab_sample_date": "2025-05-15 (Illustrative baseline)",
            "notes": (
                "ILLUSTRATIVE DEMONSTRATION SOIL BASELINE ONLY (not satellite-measured). "
                "Represents typical coastal acid-saline Pokkali silty clay before monsoon leaching. "
                "Replace with local soil testing lab results for field decisions."
            ),
        },
    },
    {
        "id": "demo-palakkad-rice-pulse",
        "name": "Chittur Alluvial Rice-Pulse Block (Demo)",
        "region": "Chittur, Palakkad, Kerala, India",
        "farming_system": "conventional_rice_pulse",
        "geometry_geojson": {
            "type": "Polygon",
            "coordinates": [
                [
                    [76.7370, 10.7000],
                    [76.7392, 10.7000],
                    [76.7392, 10.7016],
                    [76.7370, 10.7016],
                    [76.7370, 10.7000],
                ]
            ],
        },
        "elevation_m": None,
        "analysis_start_date": "2018-01-01",
        "analysis_end_date": "2026-10-31",
        "is_demo": True,
        "data_origin": "illustrative_demo",
        "notes": (
            "Conventional non-tidal demonstration farm in the Palakkad Gap agricultural plains. "
            "Included to validate configurable multi-region crop rotation modeling (rice-pulse / cereal-legume) "
            "without Pokkali-specific salinity/tidal assumptions."
        ),
        "soil": {
            "id": "soil-demo-palakkad-rice-pulse",
            "ph": 6.3,
            "ec_ds_m": 0.45,
            "organic_carbon_pct": 0.72,
            "nitrogen_kg_ha": 185.0,
            "phosphorus_kg_ha": 16.0,
            "potassium_kg_ha": 165.0,
            "soil_texture": "sandy_clay_loam",
            "field_soil_moisture_pct": 24.0,
            "salinity_class": "low",
            "irrigation_availability": "canal",
            "drainage_class": "moderately_drained",
            "waterlogging_history": "occasional_monsoon",
            "farmer_constraints": {
                "preserve_aquaculture": False,
                "max_water_demand": "medium",
                "prefer_nitrogen_fixer": True,
                "max_duration_days": 130,
                "labor_availability": "moderate",
                "notes": "Second-crop water scarcity in Jan-Mar motivates short-duration pulse/legume rotations.",
            },
            "crop_history": [
                {
                    "year": 2024,
                    "season": "Kharif / Virippu (Jun-Oct)",
                    "crop": "Paddy Rice (Jyothi / Uma)",
                    "status": "Harvested",
                    "origin": "illustrative_demo",
                },
                {
                    "year": 2025,
                    "season": "Rabi / Puncha (Nov-Feb)",
                    "crop": "Black Gram / Green Gram (Short-duration pulse)",
                    "status": "Harvested",
                    "origin": "illustrative_demo",
                },
            ],
            "data_origin": "illustrative_demo",
            "lab_sample_date": "2025-04-20 (Illustrative baseline)",
            "notes": (
                "ILLUSTRATIVE DEMONSTRATION SOIL BASELINE ONLY (not satellite-measured). "
                "Represents typical upland/plain sandy clay loam in Palakkad."
            ),
        },
    },
]


def init_db() -> None:
    ensure_postgis_if_postgres()
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        for spec in DEMO_FARMS:
            existing = db.get(Farm, spec["id"])
            if existing:
                continue
            norm_geom = extract_polygon_geometry(spec["geometry_geojson"])
            wkt, lat, lon, area_ha, perim_m = compute_geodesic_metrics(norm_geom)
            farm = Farm(
                id=spec["id"],
                name=spec["name"],
                region=spec["region"],
                farming_system=spec["farming_system"],
                geometry_geojson=norm_geom,
                geometry_wkt=wkt,
                centroid_lat=lat,
                centroid_lon=lon,
                area_hectares=area_ha,
                perimeter_meters=perim_m,
                elevation_m=spec["elevation_m"],
                analysis_start_date=spec["analysis_start_date"],
                analysis_end_date=spec["analysis_end_date"],
                is_demo=spec["is_demo"],
                data_origin=spec["data_origin"],
                notes=spec["notes"],
            )
            db.add(farm)
            soil_spec = spec["soil"]
            soil = SoilProfile(
                id=soil_spec["id"],
                farm_id=farm.id,
                ph=soil_spec["ph"],
                ec_ds_m=soil_spec["ec_ds_m"],
                organic_carbon_pct=soil_spec["organic_carbon_pct"],
                nitrogen_kg_ha=soil_spec["nitrogen_kg_ha"],
                phosphorus_kg_ha=soil_spec["phosphorus_kg_ha"],
                potassium_kg_ha=soil_spec["potassium_kg_ha"],
                soil_texture=soil_spec["soil_texture"],
                field_soil_moisture_pct=soil_spec["field_soil_moisture_pct"],
                salinity_class=soil_spec["salinity_class"],
                irrigation_availability=soil_spec["irrigation_availability"],
                drainage_class=soil_spec["drainage_class"],
                waterlogging_history=soil_spec["waterlogging_history"],
                farmer_constraints=soil_spec["farmer_constraints"],
                crop_history=soil_spec["crop_history"],
                data_origin=soil_spec["data_origin"],
                lab_sample_date=soil_spec["lab_sample_date"],
                notes=soil_spec["notes"],
            )
            db.add(soil)
        db.commit()

