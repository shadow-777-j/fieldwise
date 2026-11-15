import type {
  ClimateSimulationResponse,
  ClimateTrendsResponse,
  EarthObservationsResponse,
  Farm,
  RotationScenariosResponse,
  RotationWeights,
  SoilProfile,
  SoilProfilePayload,
  SystemStatusResponse,
  VulnerabilityAnalysisResponse,
} from '../types/fieldwise';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      detail = errBody.detail || JSON.stringify(errBody);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `Request failed with status ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  getSystemStatus: () => requestJson<SystemStatusResponse>('/api/system/status'),

  listFarms: () => requestJson<Farm[]>('/api/farms'),
  getFarm: (id: string) => requestJson<Farm>(`/api/farms/${id}`),
  createFarm: (payload: {
    name: string;
    region: string;
    farming_system: string;
    geometry_geojson: Record<string, unknown>;
    analysis_start_date: string;
    analysis_end_date: string;
    notes?: string;
  }) =>
    requestJson<Farm>('/api/farms', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateFarm: (
    id: string,
    payload: Partial<{
      name: string;
      region: string;
      farming_system: string;
      geometry_geojson: Record<string, unknown>;
      analysis_start_date: string;
      analysis_end_date: string;
      notes: string;
    }>,
  ) =>
    requestJson<Farm>(`/api/farms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteFarm: (id: string) => requestJson<void>(`/api/farms/${id}`, { method: 'DELETE' }),

  saveSoilProfile: (farmId: string, payload: SoilProfilePayload) =>
    requestJson<SoilProfile>(`/api/farms/${farmId}/soil-profile`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getEarthObservations: (farmId: string, params?: { startDate?: string; endDate?: string; forceRefresh?: boolean }) => {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('start_date', params.startDate);
    if (params?.endDate) q.set('end_date', params.endDate);
    if (params?.forceRefresh) q.set('force_refresh', 'true');
    const qs = q.toString();
    return requestJson<EarthObservationsResponse>(`/api/farms/${farmId}/earth-observations${qs ? `?${qs}` : ''}`);
  },

  getClimateTrends: (
    farmId: string,
    params?: { startDate?: string; endDate?: string; compareYearA?: number; compareYearB?: number; forceRefresh?: boolean },
  ) => {
    const q = new URLSearchParams();
    if (params?.startDate) q.set('start_date', params.startDate);
    if (params?.endDate) q.set('end_date', params.endDate);
    if (params?.compareYearA) q.set('compare_year_a', String(params.compareYearA));
    if (params?.compareYearB) q.set('compare_year_b', String(params.compareYearB));
    if (params?.forceRefresh) q.set('force_refresh', 'true');
    const qs = q.toString();
    return requestJson<ClimateTrendsResponse>(`/api/farms/${farmId}/climate-trends${qs ? `?${qs}` : ''}`);
  },

  getLatestAnalysis: (farmId: string) => requestJson<VulnerabilityAnalysisResponse>(`/api/farms/${farmId}/analyse`),
  runAnalysis: (farmId: string) =>
    requestJson<VulnerabilityAnalysisResponse>(`/api/farms/${farmId}/analyse`, { method: 'POST' }),

  evaluateRotationScenarios: (farmId: string, weights?: RotationWeights) =>
    requestJson<RotationScenariosResponse>(`/api/farms/${farmId}/rotation-scenarios`, {
      method: 'POST',
      body: JSON.stringify(weights ? { weights } : {}),
    }),

  runClimateSimulation: (
    farmId: string,
    payload: {
      rainfall_delta_pct: number;
      temperature_delta_c: number;
      water_availability_delta_pct: number;
      season_shift_days: number;
      weights?: RotationWeights;
    },
  ) =>
    requestJson<ClimateSimulationResponse>(`/api/farms/${farmId}/climate-simulation`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  previewDecisionReport: (farmId: string) =>
    requestJson<{
      farm: Farm;
      soil: SoilProfile | null;
      provenance: EarthObservationsResponse['provenance'];
      climate_summary: ClimateTrendsResponse['climate']['summary'];
      vegetation_summary: Partial<EarthObservationsResponse['modis']['vegetation_analysis']>;
      vulnerabilities: NonNullable<VulnerabilityAnalysisResponse['vulnerabilities']>;
      scenarios_bundle: RotationScenariosResponse;
    }>(`/api/farms/${farmId}/decision-report/preview`),

  getDecisionReportDownloadUrl: (farmId: string) => `${API_BASE}/api/farms/${farmId}/decision-report`,
};

