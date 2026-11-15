import { ArrowRight, Compass, Droplets, Layers, Satellite, Sprout } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip } from '../components/ChartTooltip';
import { MapWorkspace } from '../components/MapWorkspace';
import { EmptyOrErrorState, KpiCard, OriginBadge, Panel, RiskBadge } from '../components/ui';
import type {
  ClimateTrendsResponse,
  EarthObservationsResponse,
  Farm,
  PageId,
  RotationScenariosResponse,
  VulnerabilityAnalysisResponse,
} from '../types/fieldwise';

export function OverviewPage({
  farm,
  observations,
  trends,
  analysis,
  rotationResult,
  loadingObs,
  onRefreshObservations,
  onRunAnalysis,
  onNavigate,
}: {
  farm: Farm | null;
  observations: EarthObservationsResponse | null;
  trends: ClimateTrendsResponse | null;
  analysis: VulnerabilityAnalysisResponse | null;
  rotationResult: RotationScenariosResponse | null;
  loadingObs: boolean;
  onRefreshObservations: () => void;
  onRunAnalysis: () => void;
  onNavigate: (page: PageId) => void;
}) {
  if (!farm) {
    return (
      <EmptyOrErrorState
        title="No Active Farm Selected"
        message="Select an existing demonstration plot or draw a custom field boundary in Farm Explorer."
        actionLabel="Open Farm Explorer"
        onAction={() => onNavigate('explorer')}
      />
    );
  }

  const climateSum = trends?.climate.summary;
  const vegSum = observations?.modis.vegetation_analysis;
  const activeElev = observations?.srtm?.summary?.centroid_elevation_m ?? farm.elevation_m;
  const waterVuln = analysis?.vulnerabilities?.indicators.find((i) => i.id === 'water_stress');
  const recentMonthly = (trends?.climate.monthly_series || []).slice(-18);
  const recentDaily = (observations?.power_summary.recent_daily || []).slice(-7).reverse();

  let nextStep = {
    stepTag: 'Step 01',
    title: 'Synchronize NASA Earth Observations',
    desc: 'Retrieve daily NASA POWER weather, 16-day MODIS NDVI/EVI vegetation indices, and 30 m SRTM terrain context.',
    cta: 'Sync NASA Telemetry',
    action: onRefreshObservations,
  };
  if (observations && (!analysis || analysis.status === 'not_run')) {
    nextStep = {
      stepTag: 'Step 02',
      title: 'Compute 5-Component Vulnerability Index',
      desc: 'Score water stress, heat exposure, flood hazard, vegetation trajectory, and soil degradation risk.',
      cta: 'Run Vulnerability Analysis',
      action: onRunAnalysis,
    };
  } else if (analysis?.status === 'available' && !rotationResult) {
    nextStep = {
      stepTag: 'Step 03',
      title: 'Evaluate Crop-Rotation Candidates',
      desc: 'Screen rotation sequences against hard hydrological/salinity constraints and compare multi-criteria scores.',
      cta: 'Open Rotation Lab',
      action: () => onNavigate('rotation-lab'),
    };
  } else if (rotationResult) {
    nextStep = {
      stepTag: 'Step 04',
      title: 'Inspect Sensitivity or Export Decision Brief',
      desc: 'Test hypothetical weather shifts in Climate Simulator or download the evidence-backed PDF report.',
      cta: 'Open Decision Report',
      action: () => onNavigate('decision-report'),
    };
  }

  return (
    <div className="space-y-5">
      {/* Hero Band: Editorial Field Brief + Embedded Satellite Boundary Map */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="xl:col-span-7 min-w-0 flex flex-col justify-between overflow-hidden rounded-lg border border-[#E4E1D6] bg-white shadow-[0_1px_2px_rgba(23,28,25,0.03)]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6660]">
                  <span>Field Brief</span>
                  <span className="text-[#D2CFC4]">·</span>
                  <span className="text-[#154734] capitalize">{farm.farming_system.replace(/_/g, ' ')}</span>
                </div>
                <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-[#171C19]">{farm.name}</h2>
                <p className="text-xs text-[#5C6660]">{farm.region}</p>
              </div>
              <OriginBadge origin={farm.data_origin} />
            </div>

            {/* Clean Hairline-Divided Telemetry Ledger */}
            <dl className="mt-5 grid grid-cols-2 divide-y divide-[#EFECE4] border-y border-[#EFECE4] py-3 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="py-1.5 sm:pr-4 sm:py-0">
                <dt className="text-[11px] font-medium text-[#5C6660]">Geodesic Area</dt>
                <dd className="mt-0.5 tabular-nums text-sm font-bold text-[#171C19]">
                  {farm.area_hectares.toFixed(2)} ha
                </dd>
                <dd className="font-mono text-[10.5px] text-[#78827B]">
                  {(farm.area_hectares * 2.47105).toFixed(2)} acres
                </dd>
              </div>

              <div className="py-1.5 sm:px-4 sm:py-0">
                <dt className="text-[11px] font-medium text-[#5C6660]">Terrain (SRTM 30m)</dt>
                <dd className="mt-0.5 tabular-nums text-sm font-bold text-[#171C19]">
                  {activeElev !== null && activeElev !== undefined ? `${activeElev.toFixed(1)} m ASL` : 'Pending'}
                </dd>
                <dd className="font-mono text-[10.5px] text-[#78827B]">
                  {farm.centroid_lat.toFixed(4)}°N, {farm.centroid_lon.toFixed(4)}°E
                </dd>
              </div>

              <div className="py-1.5 sm:px-4 sm:py-0">
                <dt className="text-[11px] font-medium text-[#5C6660]">Soil Profile</dt>
                <dd className="mt-0.5 tabular-nums text-sm font-bold text-[#171C19]">
                  {farm.soil_profile ? `${farm.soil_profile.completeness_pct}% logged` : 'Unrecorded'}
                </dd>
                <dd className="font-mono text-[10.5px] text-[#78827B]">
                  {farm.soil_profile?.data_origin === 'illustrative_demo'
                    ? 'Illustrative baseline'
                    : farm.soil_profile?.data_origin === 'user_entered'
                      ? 'Lab / farmer input'
                      : 'Add test values'}
                </dd>
              </div>

              <div className="py-1.5 sm:pl-4 sm:py-0">
                <dt className="text-[11px] font-medium text-[#5C6660]">Telemetry Feed</dt>
                <dd className="mt-0.5 text-sm font-bold text-[#154734]">
                  {loadingObs
                    ? 'Syncing...'
                    : observations?.power_summary.status === 'available'
                      ? 'Active'
                      : 'Not Synced'}
                </dd>
                <dd className="font-mono text-[10.5px] text-[#78827B]">
                  {observations?.power_summary.summary.valid_days
                    ? `${observations.power_summary.summary.valid_days.toLocaleString()} daily pts`
                    : 'Awaiting retrieval'}
                </dd>
              </div>
            </dl>

            {farm.notes && (
              <p className="mt-4 text-xs leading-relaxed text-[#464F49]">{farm.notes}</p>
            )}
          </div>

          {/* Docked Recommended Next Action Bar */}
          <div className="flex flex-col justify-between gap-3 border-t border-[#E4E1D6] bg-[#FAF9F5] px-5 py-3.5 sm:flex-row sm:items-center sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10.5px] font-semibold uppercase text-[#154734]">{nextStep.stepTag}</span>
                <span className="text-xs font-semibold text-[#171C19]">{nextStep.title}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#5C6660]">{nextStep.desc}</p>
            </div>
            <button
              type="button"
              onClick={nextStep.action}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#154734] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#0E291E] cursor-pointer"
            >
              <span>{nextStep.cta}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>

        {/* Interactive Satellite Plot Footprint */}
        <div className="xl:col-span-5 relative min-w-0 flex">
          <MapWorkspace
            farms={[farm]}
            selectedFarm={farm}
            basemap="satellite"
            wrapperClassName="flex-1 h-full min-h-[290px]"
            heightClass="h-[290px] xl:h-full xl:min-h-[320px]"
          />
          <button
            type="button"
            onClick={() => onNavigate('explorer')}
            className="absolute bottom-8 right-3 z-10 inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-[#131C18]/85 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-xs transition-colors hover:bg-[#131C18] cursor-pointer"
          >
            <Compass className="h-3.5 w-3.5 text-emerald-300" />
            <span>Open Map Workbench</span>
          </button>
        </div>
      </div>

      {farm.soil_profile?.data_origin === 'illustrative_demo' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E6D6B8] border-l-[3px] border-l-[#B7791F] bg-[#FBF7EE] px-4 py-2 text-[11.5px] text-[#6B460B]">
          <span>
            <strong>Provenance Note:</strong> Soil pH, EC, and crop log on this demonstration plot are illustrative baselines—NASA satellite observations (weather, MODIS NDVI/EVI, SRTM) are retrieved live.
          </span>
          <button
            type="button"
            onClick={() => onNavigate('soil-profile')}
            className="font-semibold text-[#154734] hover:underline cursor-pointer"
          >
            Enter lab soil test →
          </button>
        </div>
      )}

      {/* Four Environmental Indicators */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Water Stress Risk"
          value={waterVuln?.category || null}
          unit={
            waterVuln?.index_score !== null && waterVuln?.index_score !== undefined
              ? `${waterVuln.index_score}/100`
              : undefined
          }
          subtext={
            climateSum?.dry_season_deficit_months_last_12m !== undefined
              ? `${climateSum.dry_season_deficit_months_last_12m}/12 recent months P − ET < 0`
              : 'Run Vulnerability Analysis to score'
          }
          origin={waterVuln ? 'model_derived' : undefined}
          tone={waterVuln?.category === 'High' ? 'red' : waterVuln?.category === 'Elevated' ? 'amber' : 'green'}
        />
        <KpiCard
          label="Temperature Anomaly"
          value={
            climateSum?.latest_temp_anomaly_c !== null && climateSum?.latest_temp_anomaly_c !== undefined
              ? `${climateSum.latest_temp_anomaly_c >= 0 ? '+' : ''}${climateSum.latest_temp_anomaly_c.toFixed(2)}`
              : null
          }
          unit="°C"
          subtext={
            climateSum?.mean_heat_stress_days_34c_per_yr !== undefined
              ? `Mean ${climateSum.mean_heat_stress_days_34c_per_yr.toFixed(1)} days/yr ≥ 34°C`
              : 'Requires NASA POWER series'
          }
          origin={climateSum ? 'live_retrieved' : undefined}
          tone={(climateSum?.latest_temp_anomaly_c || 0) > 0.4 ? 'amber' : 'neutral'}
        />
        <KpiCard
          label="Vegetation Vigor (NDVI)"
          value={vegSum?.latest_ndvi !== null && vegSum?.latest_ndvi !== undefined ? vegSum.latest_ndvi.toFixed(3) : null}
          unit={vegSum?.latest_date ? `${vegSum.latest_date}` : undefined}
          subtext={
            vegSum?.mean_ndvi !== null && vegSum?.mean_ndvi !== undefined
              ? `Mean ${vegSum.mean_ndvi.toFixed(3)} · Trend ${(vegSum.ndvi_trend_per_year ?? 0) >= 0 ? '+' : ''}${(vegSum.ndvi_trend_per_year ?? 0).toFixed(4)}/yr`
              : 'MODIS MOD13Q1 QA-filtered 250 m'
          }
          origin={vegSum?.status === 'available' ? 'historical_satellite' : undefined}
          tone="green"
        />
        <KpiCard
          label="Annual Rainfall"
          value={
            climateSum?.latest_complete_rainfall_mm !== null && climateSum?.latest_complete_rainfall_mm !== undefined
              ? Math.round(climateSum.latest_complete_rainfall_mm).toLocaleString()
              : null
          }
          unit={climateSum?.latest_complete_year ? `mm (${climateSum.latest_complete_year})` : 'mm'}
          subtext={
            climateSum?.latest_rainfall_anomaly_mm !== null && climateSum?.latest_rainfall_anomaly_mm !== undefined
              ? `${climateSum.latest_rainfall_anomaly_mm >= 0 ? '+' : ''}${Math.round(climateSum.latest_rainfall_anomaly_mm)} mm vs multi-year mean`
              : 'NASA POWER PRECTOTCORR'
          }
          origin={climateSum ? 'live_retrieved' : undefined}
          tone="neutral"
        />
      </div>

      {/* Rainfall / Soil Moisture Chart + Daily Telemetry Ledger */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Panel
          className="xl:col-span-7"
          title="Precipitation & Root-Zone Soil Wetness"
          subtitle="Recent 18 months · NASA POWER / MERRA-2 (~55 km native meteorological grid)"
          right={<OriginBadge origin="live_retrieved" />}
        >
          {recentMonthly.length > 0 ? (
            <div className="h-68 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={recentMonthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rainFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1E4E68" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#1E4E68" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="wetFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#154734" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#154734" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ECEAE1" vertical={false} />
                  <XAxis
                    dataKey="year_month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10.5, fill: '#5C6660' }}
                  />
                  <YAxis
                    yAxisId="rain"
                    width={42}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10.5, fill: '#5C6660' }}
                  />
                  <YAxis
                    yAxisId="soil"
                    orientation="right"
                    width={36}
                    domain={[0, 1]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10.5, fill: '#154734' }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    yAxisId="rain"
                    type="monotone"
                    dataKey="rainfall_mm"
                    name="Monthly Rainfall (mm)"
                    stroke="#1E4E68"
                    fill="url(#rainFill)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Area
                    yAxisId="soil"
                    type="monotone"
                    dataKey="mean_gwetroot"
                    name="Root-Zone Wetness (0–1)"
                    stroke="#154734"
                    fill="url(#wetFill)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyOrErrorState
              title="No Climate Observations Loaded"
              message="Click 'Sync NASA Data' to retrieve real daily NASA POWER precipitation, temperature, and root-zone soil wetness."
              actionLabel="Sync NASA Data"
              onAction={onRefreshObservations}
            />
          )}
        </Panel>

        <Panel
          className="xl:col-span-5"
          title="Daily NASA POWER Telemetry Log"
          subtitle="Latest 7 available observation days"
          right={<OriginBadge origin="live_retrieved" />}
        >
          {recentDaily.length > 0 ? (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E1D6] text-[10.5px] font-semibold uppercase tracking-wide text-[#5C6660]">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 px-2">Tmean</th>
                      <th className="py-2 px-2">Rain</th>
                      <th className="py-2 px-2">Root Wet</th>
                      <th className="py-2 pl-2 text-right">P − ET*</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE4] tabular-nums">
                    {recentDaily.map((d) => (
                      <tr key={d.date} className="hover:bg-[#FAF9F5]">
                        <td className="py-2 pr-2 font-mono text-[11px] font-medium text-[#171C19]">{d.date}</td>
                        <td className="py-2 px-2 text-[#333B36]">{d.t2m !== null ? `${d.t2m.toFixed(1)}°C` : '—'}</td>
                        <td className="py-2 px-2 text-[#333B36]">
                          {d.precip_mm !== null ? `${d.precip_mm.toFixed(1)} mm` : '—'}
                        </td>
                        <td className="py-2 px-2 text-[#333B36]">
                          {d.gwetroot !== null ? d.gwetroot.toFixed(2) : '—'}
                        </td>
                        <td className="py-2 pl-2 text-right font-mono text-[11px] text-[#333B36]">
                          {d.partial_water_balance_mm !== null ? `${d.partial_water_balance_mm.toFixed(1)} mm` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 border-t border-[#EFECE4] pt-2.5 text-[10.5px] leading-snug text-[#78827B]">
                *Partial atmospheric balance indicator (PRECTOTCORR − EVPTRNS/2.45), excluding tidal exchange and irrigation.
              </p>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#5C6660]">No recent daily observations synced yet.</div>
          )}
        </Panel>
      </div>

      {/* Vulnerability Ledger Strip */}
      {analysis?.status === 'available' && analysis.vulnerabilities && (
        <Panel
          title="Vulnerability Risk Snapshot"
          subtitle={`Overall assessment confidence: ${analysis.vulnerabilities.overall_confidence}`}
          right={
            <button
              type="button"
              onClick={() => onNavigate('vulnerability')}
              className="text-xs font-semibold text-[#154734] hover:underline cursor-pointer"
            >
              Inspect full diagnostics →
            </button>
          }
        >
          <div className="grid grid-cols-1 divide-y divide-[#EFECE4] sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
            {analysis.vulnerabilities.indicators.map((ind) => (
              <div key={ind.id} className="py-3 lg:px-4 lg:py-1 first:lg:pl-0 last:lg:pr-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-[#171C19] leading-snug">{ind.name}</span>
                  <RiskBadge category={ind.category} />
                </div>
                <div className="mt-2.5 flex items-baseline justify-between">
                  <span className="tabular-nums text-lg font-bold text-[#171C19]">
                    {ind.index_score !== null ? ind.index_score.toFixed(1) : 'N/A'}
                    {ind.index_score !== null && <span className="ml-0.5 text-[11px] font-normal text-[#78827B]">/100</span>}
                  </span>
                  <span className="font-mono text-[10.5px] text-[#5C6660]">{ind.confidence}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Calm Quick-Access Index Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Draw or Edit Boundary', sub: 'Farm Explorer', page: 'explorer' as PageId, Icon: Compass },
          { label: 'Inspect Satellite Rasters', sub: 'GIBS & Landsat STAC', page: 'earth-intelligence' as PageId, Icon: Satellite },
          { label: 'Log Soil Chemistry', sub: 'pH, EC & Organic C', page: 'soil-profile' as PageId, Icon: Sprout },
          { label: 'Compare Crop Rotations', sub: 'Rotation Lab', page: 'rotation-lab' as PageId, Icon: Layers },
        ].map(({ label, sub, page, Icon }) => (
          <button
            key={page}
            type="button"
            onClick={() => onNavigate(page)}
            className="group flex items-center gap-3 rounded-lg border border-[#E4E1D6] bg-white px-4 py-3 text-left transition-all hover:border-[#154734]/50 hover:shadow-xs cursor-pointer"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#F3F8F5] text-[#154734] transition-colors group-hover:bg-[#154734] group-hover:text-white">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-[#171C19]">{label}</div>
              <div className="truncate text-[11px] text-[#5C6660]">{sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Unused icon import safeguard */}
      <span className="sr-only">
        <Droplets />
      </span>
    </div>
  );
}
