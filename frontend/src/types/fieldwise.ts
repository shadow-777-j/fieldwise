export type DataOrigin =
  | 'live_retrieved'
  | 'historical_satellite'
  | 'user_entered'
  | 'illustrative_demo'
  | 'model_derived'
  | 'hypothetical_simulation';

export type PageId =
  | 'overview'
  | 'explorer'
  | 'earth-intelligence'
  | 'climate-history'
  | 'soil-profile'
  | 'vulnerability'
  | 'rotation-lab'
  | 'climate-simulator'
  | 'decision-report';

export interface GeoJSONPolygon {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

export interface CropHistoryEntry {
  year: number;
  season: string;
  crop: string;
  status: string;
  origin: DataOrigin | string;
}

export interface FarmerConstraints {
  preserve_aquaculture?: boolean;
  max_water_demand?: string;
  prefer_nitrogen_fixer?: boolean;
  max_duration_days?: number;
  labor_availability?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface SoilProfile {
  id: string;
  farm_id: string;
  ph: number | null;
  ec_ds_m: number | null;
  organic_carbon_pct: number | null;
  nitrogen_kg_ha: number | null;
  phosphorus_kg_ha: number | null;
  potassium_kg_ha: number | null;
  soil_texture: string | null;
  field_soil_moisture_pct: number | null;
  salinity_class: string | null;
  irrigation_availability: string | null;
  drainage_class: string | null;
  waterlogging_history: string | null;
  farmer_constraints: FarmerConstraints;
  crop_history: CropHistoryEntry[];
  data_origin: DataOrigin | string;
  lab_sample_date: string | null;
  notes: string | null;
  completeness_pct: number;
  missing_parameters: string[];
  updated_at: string;
}

export interface SoilProfilePayload {
  ph: number | null;
  ec_ds_m: number | null;
  organic_carbon_pct: number | null;
  nitrogen_kg_ha: number | null;
  phosphorus_kg_ha: number | null;
  potassium_kg_ha: number | null;
  soil_texture: string | null;
  field_soil_moisture_pct: number | null;
  salinity_class: string | null;
  irrigation_availability: string | null;
  drainage_class: string | null;
  waterlogging_history: string | null;
  farmer_constraints: FarmerConstraints;
  crop_history: CropHistoryEntry[];
  lab_sample_date: string | null;
  notes: string | null;
}

export interface Farm {
  id: string;
  name: string;
  region: string;
  farming_system: string;
  geometry_geojson: GeoJSONPolygon;
  centroid_lat: number;
  centroid_lon: number;
  area_hectares: number;
  perimeter_meters: number;
  elevation_m: number | null;
  analysis_start_date: string;
  analysis_end_date: string;
  is_demo: boolean;
  data_origin: DataOrigin | string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  soil_profile: SoilProfile | null;
}

export interface DatasetProvenance {
  source_name: string;
  product_identifier: string;
  observation_period: string;
  spatial_resolution: string;
  temporal_resolution: string;
  processing_date: string;
  missing_data_status: string;
  data_origin: DataOrigin | string;
  resolution_caveat?: string;
}

export interface GIBSLayer {
  id: string;
  name: string;
  dataset_id: string;
  gibs_layer: string;
  observation_date: string;
  spatial_resolution: string;
  temporal_resolution: string;
  max_zoom: number;
  tile_url_template: string;
  status: string;
  data_origin: DataOrigin | string;
  legend: { label: string; color: string }[];
  description: string;
}

export interface LandsatSTACScene {
  scene_id: string;
  datetime: string;
  date: string;
  platform: string;
  cloud_cover_pct: number | null;
  sun_elevation: number | null;
  wrs_path: string | null;
  wrs_row: string | null;
}

export interface EarthObservationsResponse {
  farm_id: string;
  observation_period: { start: string; end: string };
  power_summary: {
    status: string;
    cache_hit: boolean;
    summary: {
      total_days?: number;
      valid_days?: number;
      grid_elevation_m?: number;
      missing_counts?: Record<string, number>;
    };
    recent_daily: {
      date: string;
      t2m: number | null;
      t2m_max: number | null;
      t2m_min: number | null;
      precip_mm: number | null;
      solar_mj_m2: number | null;
      rh2m_pct: number | null;
      gwettop: number | null;
      gwetroot: number | null;
      et_mm: number | null;
      partial_water_balance_mm: number | null;
    }[];
    provenance: DatasetProvenance;
  };
  modis: {
    status: string;
    cache_hit: boolean;
    summary: {
      total_composites?: number;
      qa_valid_composites?: number;
      cloudy_or_fill_composites?: number;
      latest_valid_ndvi?: number | null;
      latest_valid_evi?: number | null;
      latest_valid_date?: string | null;
    };
    vegetation_analysis: VegetationAnalysis;
    provenance: DatasetProvenance;
  };
  landsat_stac: {
    status: string;
    scenes: LandsatSTACScene[];
    summary?: {
      total_scenes_found: number;
      low_cloud_scenes_lt35pct: number;
      latest_scene_date: string | null;
      latest_low_cloud_date: string | null;
    };
    provenance: DatasetProvenance;
  };
  srtm: {
    status: string;
    summary: {
      centroid_elevation_m?: number;
      mean_elevation_m?: number;
      min_elevation_m?: number;
      max_elevation_m?: number;
      local_relief_m?: number;
      terrain_context?: string;
    };
    provenance: DatasetProvenance;
  };
  gee: {
    status: string;
    authenticated: boolean;
    reason?: string;
    setup_instructions?: string[];
    landsat_records: {
      date: string;
      spacecraft: string;
      cloud_cover_pct: number;
      ndvi: number;
      evi: number | null;
    }[];
    landsat_tile_url: string | null;
    smap_summary: {
      sm_surface_m3_m3: number | null;
      sm_rootzone_m3_m3: number | null;
    } | null;
    provenance: DatasetProvenance;
  };
  gibs_layers: GIBSLayer[];
  provenance: DatasetProvenance[];
}

export interface VegetationAnalysis {
  status: string;
  primary_source: string;
  valid_observations: number;
  total_modis_composites?: number;
  mean_ndvi: number | null;
  mean_evi: number | null;
  latest_ndvi: number | null;
  latest_evi: number | null;
  latest_date: string | null;
  ndvi_trend_per_year: number | null;
  recent_vs_baseline_anomaly: number | null;
  monthly_climatology: { month: number; label: string; mean_ndvi: number | null; sample_count: number }[];
  series: { date: string; ndvi: number | null; evi: number | null; qa_label?: string; cloud_free?: boolean }[];
  landsat_series?: { date: string; ndvi: number; evi: number | null; spacecraft?: string }[];
}

export interface ClimateTrendsResponse {
  farm_id: string;
  observation_period: { start: string; end: string };
  climate: {
    status: string;
    available_years: number[];
    baseline_annual_rainfall_mm: number | null;
    baseline_annual_temp_c: number | null;
    annual_series: {
      year: number;
      observation_days: number;
      valid_precip_days: number;
      total_rainfall_mm: number | null;
      rainfall_anomaly_mm: number | null;
      mean_temp_c: number | null;
      max_temp_c: number | null;
      mean_tmax_c: number | null;
      temp_anomaly_c: number | null;
      heavy_rain_days_20mm: number;
      extreme_rain_days_50mm: number;
      heat_stress_days_34c: number;
      mean_gwettop: number | null;
      mean_gwetroot: number | null;
      partial_et_mm: number | null;
      partial_water_balance_mm: number | null;
    }[];
    monthly_series: {
      year_month: string;
      year: number;
      month: number;
      month_label: string;
      rainfall_mm: number | null;
      rainfall_anomaly_mm: number | null;
      mean_temp_c: number | null;
      max_temp_c: number | null;
      temp_anomaly_c: number | null;
      mean_gwettop: number | null;
      mean_gwetroot: number | null;
      std_soil_moisture_anomaly: number | null;
      partial_et_mm: number | null;
      partial_water_balance_mm: number | null;
    }[];
    seasonal_series: {
      season_year: number;
      season: string;
      days: number;
      rainfall_mm: number | null;
      rainfall_anomaly_mm: number | null;
      mean_temp_c: number | null;
      temp_anomaly_c: number | null;
      mean_gwetroot: number | null;
      std_soil_moisture_anomaly: number | null;
      partial_water_balance_mm: number | null;
    }[];
    year_comparison: {
      year_a: number;
      year_b: number;
      months: {
        month: number;
        month_label: string;
        baseline_rainfall_mm: number | null;
        year_a_rainfall_mm: number | null;
        year_b_rainfall_mm: number | null;
        year_a_temp_c: number | null;
        year_b_temp_c: number | null;
        year_a_gwetroot: number | null;
        year_b_gwetroot: number | null;
      }[];
    } | null;
    water_balance_note: string;
    summary: {
      latest_complete_year?: number;
      latest_complete_rainfall_mm?: number;
      latest_rainfall_anomaly_mm?: number;
      latest_temp_anomaly_c?: number;
      latest_mean_gwetroot?: number;
      latest_std_soil_anomaly?: number;
      mean_extreme_rain_days_50mm_per_yr?: number;
      mean_heat_stress_days_34c_per_yr?: number;
      dry_season_deficit_months_last_12m?: number;
    };
  };
  vegetation: VegetationAnalysis;
  provenance: DatasetProvenance[];
}

export interface VulnerabilityIndicator {
  id: string;
  name: string;
  category: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Insufficient Data' | string;
  index_score: number | null;
  calculation_method: string;
  supporting_observations: string[];
  confidence: string;
  limitations: string;
  data_origin: string;
}

export interface VulnerabilityAnalysisResponse {
  status: string;
  farm_id: string;
  analysis_id?: string;
  created_at?: string;
  observation_period?: { start: string; end: string };
  vulnerabilities?: {
    indicators: VulnerabilityIndicator[];
    overall_confidence: string;
    insufficient_count: number;
  };
  climate_summary?: ClimateTrendsResponse['climate']['summary'];
  vegetation_summary?: Partial<VegetationAnalysis>;
  provenance?: DatasetProvenance[];
}

export interface RotationWeights {
  water_sustainability: number;
  soil_improvement: number;
  climate_resilience: number;
  economic_potential: number;
  erosion_protection: number;
  farmer_preference: number;
}

export interface RotationScenario {
  id: string;
  strategy_group: string;
  name: string;
  crops: string[];
  season_calendar: string;
  duration_days: number;
  status: string;
  eligible: boolean;
  final_score: number | null;
  baseline_score?: number | null;
  score_delta?: number | null;
  baseline_eligible?: boolean;
  criteria_scores: RotationWeights;
  weights_applied: RotationWeights;
  comparison_attributes: {
    water_requirement_mm: number;
    water_demand_class: string;
    soil_improvement_score: number;
    nitrogen_fixation_kg_ha: number;
    organic_matter_contribution: string;
    growing_season_compatibility: string;
    salinity_tolerance: string;
    waterlogging_tolerance: string;
    pest_cycle_interruption: string;
    erosion_protection_score: number;
    economic_potential_score: number;
    farmer_preference_score: number;
  };
  exclusion_reasons: string[];
  warnings: string[];
  unknown_checks: string[];
  evidence_status: string;
  explanation: {
    summary: string;
    positive_drivers: string[];
    risk_penalties: string[];
  };
  data_origin: string;
}

export interface RotationScenariosResponse {
  farm_id: string;
  farming_system: string;
  weights_normalized_pct: RotationWeights;
  climate_context: Record<string, number | null>;
  recommended_strategy: RotationScenario | null;
  scenarios: RotationScenario[];
  eligible_count: number;
  excluded_count: number;
  formula: string;
  data_origin: string;
}

export interface ClimateSimulationResponse {
  is_hypothetical: boolean;
  disclaimer: string;
  perturbations: {
    rainfall_delta_pct: number;
    temperature_delta_c: number;
    water_availability_delta_pct: number;
    season_shift_days: number;
  };
  baseline_top_strategy: RotationScenario | null;
  simulated_top_strategy: RotationScenario | null;
  scenarios: RotationScenario[];
  climate_context: Record<string, number | null>;
  data_origin: string;
}

export interface SystemStatusResponse {
  app_name: string;
  version: string;
  database_backend: string;
  data_services: {
    nasa_power: { status: string; endpoint: string; auth_required: boolean };
    ornl_modis: { status: string; endpoint: string; auth_required: boolean };
    nasa_gibs: { status: string; endpoint: string; auth_required: boolean };
    earth_search_stac: { status: string; endpoint: string; auth_required: boolean };
    srtm_elevation: { status: string; endpoint: string; auth_required: boolean };
    google_earth_engine: {
      authenticated: boolean;
      status: string;
      project?: string;
      reason?: string;
      setup_instructions?: string[];
      verified_catalog: Record<string, { collection_id: string; name: string; spatial_resolution: string; temporal_resolution: string }>;
    };
  };
}

