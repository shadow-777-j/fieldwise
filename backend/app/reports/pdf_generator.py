from datetime import datetime, timezone
from io import BytesIO
from typing import Any, Dict, List
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FOREST_GREEN = colors.HexColor("#143D2B")
DEEP_NAVY = colors.HexColor("#0F2137")
MINT_BG = colors.HexColor("#EEF4F0")
BORDER_GRAY = colors.HexColor("#CFD7D2")
TEXT_DARK = colors.HexColor("#18221D")
TEXT_MUTED = colors.HexColor("#526059")
AMBER_BG = colors.HexColor("#FEF7E6")


def _fmt(val: Any, suffix: str = "") -> str:
    if val is None or val == "":
        return "Unknown / Not Recorded"
    return f"{val}{suffix}"


def _make_table(data: List[List[Any]], col_widths: List[float], header_bg=FOREST_GREEN) -> Table:
    tbl = Table(data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), header_bg),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8.5),
                ("FONTSIZE", (0, 1), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, MINT_BG]),
                ("GRID", (0, 0), (-1, -1), 0.4, BORDER_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return tbl


def build_decision_report_pdf(report_bundle: Dict[str, Any]) -> bytes:
    """Render an evidence-backed multi-section PDF decision report via ReportLab."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"FIELDWISE AI Decision Report - {report_bundle['farm']['name']}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "FieldwiseTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=17,
        textColor=FOREST_GREEN,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "FieldwiseSubtitle",
        parent=styles["Normal"],
        fontSize=9.5,
        textColor=DEEP_NAVY,
        spaceAfter=10,
    )
    h2_style = ParagraphStyle(
        "FieldwiseH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11.5,
        textColor=DEEP_NAVY,
        spaceBefore=10,
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "FieldwiseBody",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11.5,
        textColor=TEXT_DARK,
        spaceAfter=4,
    )
    cell_style = ParagraphStyle(
        "FieldwiseCell",
        parent=styles["Normal"],
        fontSize=7.8,
        leading=10.2,
        textColor=TEXT_DARK,
    )
    cell_hdr = ParagraphStyle(
        "FieldwiseCellHdr",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10.2,
        textColor=colors.white,
    )

    farm = report_bundle["farm"]
    soil = report_bundle.get("soil") or {}
    provenance_list = report_bundle.get("provenance") or []
    climate_summary = report_bundle.get("climate_summary") or {}
    veg_summary = report_bundle.get("vegetation_summary") or {}
    vulnerabilities = report_bundle.get("vulnerabilities") or {}
    scenarios_bundle = report_bundle.get("scenarios_bundle") or {}

    story: List[Any] = []
    generated_ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Header
    story.append(Paragraph("FIELDWISE AI — Agricultural Intelligence & Decision Report", title_style))
    story.append(
        Paragraph(
            f"<b>Farm:</b> {farm['name']} &nbsp;|&nbsp; <b>Region:</b> {farm['region']} &nbsp;|&nbsp; "
            f"<b>Generated:</b> {generated_ts}",
            subtitle_style,
        )
    )

    # 1. Farm Profile
    story.append(Paragraph("1. Farm Profile & Analysis Window", h2_style))
    farm_rows = [
        [Paragraph("Attribute", cell_hdr), Paragraph("Value", cell_hdr), Paragraph("Attribute", cell_hdr), Paragraph("Value", cell_hdr)],
        [
            Paragraph("Farm ID", cell_style),
            Paragraph(str(farm["id"]), cell_style),
            Paragraph("Farming System", cell_style),
            Paragraph(str(farm["farming_system"]).replace("_", " ").title(), cell_style),
        ],
        [
            Paragraph("Centroid Coordinates", cell_style),
            Paragraph(f"{farm['centroid_lat']:.5f}° N, {farm['centroid_lon']:.5f}° E", cell_style),
            Paragraph("Geodesic Area", cell_style),
            Paragraph(f"{farm['area_hectares']:.2f} ha ({farm['area_hectares'] * 2.47105:.2f} acres)", cell_style),
        ],
        [
            Paragraph("SRTM Terrain Elevation", cell_style),
            Paragraph(_fmt(farm.get("elevation_m"), " m ASL"), cell_style),
            Paragraph("Analysis Period", cell_style),
            Paragraph(f"{farm['analysis_start_date']} to {farm['analysis_end_date']}", cell_style),
        ],
        [
            Paragraph("Profile Data Origin", cell_style),
            Paragraph(str(farm.get("data_origin", "user_entered")), cell_style),
            Paragraph("Perimeter", cell_style),
            Paragraph(f"{farm['perimeter_meters']:.1f} m", cell_style),
        ],
    ]
    story.append(_make_table(farm_rows, [36 * mm, 52 * mm, 36 * mm, 54 * mm]))

    # 2. Soil & Management Profile
    story.append(Paragraph("2. Soil & Field Management Profile", h2_style))
    story.append(
        Paragraph(
            f"<b>Soil Data Origin:</b> {soil.get('data_origin', 'Not Recorded')} &nbsp;|&nbsp; "
            "<i>Note: Satellite datasets never directly measure soil pH, EC, or NPK concentrations.</i>",
            body_style,
        )
    )
    soil_rows = [
        [Paragraph("Parameter", cell_hdr), Paragraph("Value", cell_hdr), Paragraph("Parameter", cell_hdr), Paragraph("Value", cell_hdr)],
        [
            Paragraph("Soil pH", cell_style),
            Paragraph(_fmt(soil.get("ph")), cell_style),
            Paragraph("Electrical Conductivity (EC)", cell_style),
            Paragraph(_fmt(soil.get("ec_ds_m"), " dS/m"), cell_style),
        ],
        [
            Paragraph("Organic Carbon", cell_style),
            Paragraph(_fmt(soil.get("organic_carbon_pct"), " %"), cell_style),
            Paragraph("Salinity Class", cell_style),
            Paragraph(_fmt(soil.get("salinity_class")), cell_style),
        ],
        [
            Paragraph("N / P / K (kg/ha)", cell_style),
            Paragraph(
                f"{_fmt(soil.get('nitrogen_kg_ha'))} / {_fmt(soil.get('phosphorus_kg_ha'))} / {_fmt(soil.get('potassium_kg_ha'))}",
                cell_style,
            ),
            Paragraph("Soil Texture", cell_style),
            Paragraph(_fmt(soil.get("soil_texture")), cell_style),
        ],
        [
            Paragraph("Irrigation Availability", cell_style),
            Paragraph(_fmt(soil.get("irrigation_availability")), cell_style),
            Paragraph("Drainage / Waterlogging", cell_style),
            Paragraph(f"{_fmt(soil.get('drainage_class'))} / {_fmt(soil.get('waterlogging_history'))}", cell_style),
        ],
    ]
    story.append(_make_table(soil_rows, [38 * mm, 50 * mm, 40 * mm, 50 * mm]))

    # 3. Earth Observation Data Provenance
    story.append(Paragraph("3. NASA & Satellite Dataset Provenance", h2_style))
    prov_rows = [[
        Paragraph("Source / Dataset", cell_hdr),
        Paragraph("Product ID", cell_hdr),
        Paragraph("Native Resolution", cell_hdr),
        Paragraph("Period", cell_hdr),
        Paragraph("Missing-Data / Status", cell_hdr),
    ]]
    for p in provenance_list:
        prov_rows.append([
            Paragraph(str(p.get("source_name", "")), cell_style),
            Paragraph(str(p.get("product_identifier", "")), cell_style),
            Paragraph(str(p.get("spatial_resolution", "")), cell_style),
            Paragraph(str(p.get("observation_period", "")), cell_style),
            Paragraph(str(p.get("missing_data_status", "")), cell_style),
        ])
    if len(prov_rows) > 1:
        story.append(_make_table(prov_rows, [34 * mm, 36 * mm, 32 * mm, 30 * mm, 46 * mm], header_bg=DEEP_NAVY))

    # 4. Environmental Indicators & Historical Trends
    story.append(Paragraph("4. Retrieved Environmental Indicators & Historical Trends", h2_style))
    env_rows = [
        [Paragraph("Indicator", cell_hdr), Paragraph("Observed Value", cell_hdr), Paragraph("Origin / Context", cell_hdr)],
        [
            Paragraph("Latest Complete Annual Rainfall", cell_style),
            Paragraph(_fmt(climate_summary.get("latest_complete_rainfall_mm"), " mm"), cell_style),
            Paragraph(f"NASA POWER PRECTOTCORR (Year {climate_summary.get('latest_complete_year', '-')})", cell_style),
        ],
        [
            Paragraph("Annual Rainfall Anomaly", cell_style),
            Paragraph(
                f"{climate_summary['latest_rainfall_anomaly_mm']:+.1f} mm"
                if climate_summary.get("latest_rainfall_anomaly_mm") is not None
                else "Insufficient Baseline",
                cell_style,
            ),
            Paragraph("Observed annual minus multi-year complete baseline", cell_style),
        ],
        [
            Paragraph("Annual Temperature Anomaly", cell_style),
            Paragraph(
                f"{climate_summary['latest_temp_anomaly_c']:+.2f} °C"
                if climate_summary.get("latest_temp_anomaly_c") is not None
                else "Insufficient Baseline",
                cell_style,
            ),
            Paragraph("NASA POWER T2M vs multi-year mean", cell_style),
        ],
        [
            Paragraph("Mean Extreme Rain Days (>=50 mm/d)", cell_style),
            Paragraph(_fmt(climate_summary.get("mean_extreme_rain_days_50mm_per_yr"), " days/yr"), cell_style),
            Paragraph("NASA POWER daily precipitation intensity", cell_style),
        ],
        [
            Paragraph("Dry-Season Partial Water Deficit Months", cell_style),
            Paragraph(_fmt(climate_summary.get("dry_season_deficit_months_last_12m"), " / 12 months"), cell_style),
            Paragraph("Partial P - ET indicator (not a full hydrological model)", cell_style),
        ],
        [
            Paragraph("Long-Term Mean NDVI / Latest NDVI", cell_style),
            Paragraph(
                f"{_fmt(veg_summary.get('mean_ndvi'))} / {_fmt(veg_summary.get('latest_ndvi'))}",
                cell_style,
            ),
            Paragraph(f"{veg_summary.get('primary_source', 'MODIS/Landsat')} ({veg_summary.get('valid_observations', 0)} QA-valid)", cell_style),
        ],
    ]
    story.append(_make_table(env_rows, [54 * mm, 44 * mm, 80 * mm]))

    # 5. Vulnerability Assessment
    story.append(Paragraph("5. Five-Component Farm Vulnerability Assessment", h2_style))
    vuln_rows = [[
        Paragraph("Indicator", cell_hdr),
        Paragraph("Category", cell_hdr),
        Paragraph("Score", cell_hdr),
        Paragraph("Confidence", cell_hdr),
        Paragraph("Key Observations & Limitations", cell_hdr),
    ]]
    for ind in vulnerabilities.get("indicators", []):
        obs_txt = "; ".join(ind.get("supporting_observations", [])[:2])
        lim_txt = ind.get("limitations", "")
        vuln_rows.append([
            Paragraph(str(ind.get("name", "")), cell_style),
            Paragraph(f"<b>{ind.get('category', '')}</b>", cell_style),
            Paragraph(f"{ind['index_score']:.1f}/100" if ind.get("index_score") is not None else "N/A", cell_style),
            Paragraph(str(ind.get("confidence", "")), cell_style),
            Paragraph(f"{obs_txt}<br/><i>Limitation: {lim_txt}</i>", cell_style),
        ])
    story.append(_make_table(vuln_rows, [32 * mm, 24 * mm, 18 * mm, 24 * mm, 80 * mm], header_bg=DEEP_NAVY))

    # 6. Crop Rotation Scenarios & Comparative Scores
    story.append(Paragraph("6. Crop-Rotation Scenario Comparison & Recommendation", h2_style))
    top = scenarios_bundle.get("recommended_strategy")
    if top:
        story.append(
            Paragraph(
                f"<b>Top-Ranked Strategy:</b> {top['name']} — <b>Score: {top['final_score']}/100</b>. "
                f"{top['explanation']['summary']}",
                body_style,
            )
        )
    scen_rows = [[
        Paragraph("Strategy", cell_hdr),
        Paragraph("Status", cell_hdr),
        Paragraph("Final Score", cell_hdr),
        Paragraph("Water / Soil / Clim", cell_hdr),
        Paragraph("Agronomic Rationale / Exclusions", cell_hdr),
    ]]
    for sc in scenarios_bundle.get("scenarios", []):
        cs = sc.get("criteria_scores", {})
        sub_str = f"{cs.get('water_sustainability', '-')}/{cs.get('soil_improvement', '-')}/{cs.get('climate_resilience', '-')}"
        notes_parts = []
        if sc.get("exclusion_reasons"):
            notes_parts.append("<b>EXCLUDED:</b> " + " ".join(sc["exclusion_reasons"]))
        if sc.get("explanation", {}).get("positive_drivers"):
            notes_parts.append("Drivers: " + "; ".join(sc["explanation"]["positive_drivers"]))
        if sc.get("explanation", {}).get("risk_penalties"):
            notes_parts.append("Risks: " + "; ".join(sc["explanation"]["risk_penalties"]))
        if not notes_parts:
            notes_parts.append(sc.get("explanation", {}).get("summary", ""))

        scen_rows.append([
            Paragraph(f"<b>{sc['strategy_group']}</b><br/>{sc['name']}", cell_style),
            Paragraph(str(sc.get("status", "")), cell_style),
            Paragraph(f"<b>{sc['final_score']}</b>" if sc.get("final_score") is not None else "Excluded", cell_style),
            Paragraph(sub_str, cell_style),
            Paragraph(" ".join(notes_parts), cell_style),
        ])
    story.append(_make_table(scen_rows, [42 * mm, 28 * mm, 18 * mm, 24 * mm, 66 * mm]))

    # 7. Limitations & Local Validation Recommendations
    story.append(Paragraph("7. Limitations & Recommendations for Local Agricultural Validation", h2_style))
    limitations = [
        "• Coarse-resolution satellite products (NASA POWER ~55 km, SMAP 9 km, GPM IMERG ~10 km) reflect regional conditions and do not separate adjacent smallholder fields.",
        "• NASA satellites do not directly measure soil pH, electrical conductivity (EC), or NPK levels. Verify illustrative or unknown soil metrics through local Krishi Bhavan / ICAR soil testing laboratories.",
        "• Partial water balance (P - ET) excludes tidal saline inflow, sluice-gate regulation, canal releases, and groundwater pumping.",
        "• Validate recommended rotation calendars and cultivar tolerances (e.g., Vyttila-11 for Pokkali wetlands or pulse varieties for plains) with local extension officers before planting.",
    ]
    for item in limitations:
        story.append(Paragraph(item, body_style))

    doc.build(story)
    return buffer.getvalue()

