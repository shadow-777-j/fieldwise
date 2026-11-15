import { useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip } from '../components/ChartTooltip';
import { EmptyOrErrorState, OriginBadge, Panel } from '../components/ui';
import type { ClimateTrendsResponse, Farm } from '../types/fieldwise';

export function ClimateHistoryPage({
  farm,
  trends,
  loading,
  onReloadWithYears,
}: {
  farm: Farm | null;
  trends: ClimateTrendsResponse | null;
  loading: boolean;
  onReloadWithYears: (startDate: string, endDate: string, yearA: number, yearB: number) => void;
}) {
  const availableYears = trends?.climate.available_years || [];
  const [startDate, setStartDate] = useState(farm?.analysis_start_date || '2018-01-01');
  const [endDate, setEndDate] = useState(farm?.analysis_end_date || '2026-10-31');
  const [yearASel, setYearASel] = useState<number | null>(null);
  const [yearBSel, setYearBSel] = useState<number | null>(null);

  const yearA =
    yearASel ?? trends?.climate.year_comparison?.year_a ?? (availableYears[Math.max(0, availableYears.length - 2)] || 2024);
  const yearB =
    yearBSel ?? trends?.climate.year_comparison?.year_b ?? (availableYears[Math.max(0, availableYears.length - 1)] || 2025);

  if (!farm) {
    return <EmptyOrErrorState title="No Farm Selected" message="Select a field to inspect climate and vegetation history." />;
  }

  if (!trends || trends.climate.status !== 'available') {
    return (
      <EmptyOrErrorState
        title="Climate History Not Retrieved"
        message="Synchronize NASA POWER and MODIS data to view multi-year rainfall, temperature, soil wetness, and vegetation trends."
        actionLabel={loading ? 'Loading...' : 'Load Climate History'}
        onAction={() => onReloadWithYears(startDate, endDate, yearA, yearB)}
      />
    );
  }

  const { climate, vegetation } = trends;
  const recentMonthly = climate.monthly_series.slice(-36);
  const seasonal = climate.seasonal_series.slice(-18);

  const fieldCls =
    'mt-1 rounded-md border border-[#D8D4C8] bg-[#FAF9F5] px-2.5 py-1 text-xs text-[#171C19] focus:border-[#154734] focus:bg-white focus:outline-none';

  return (
    <div className="space-y-5">
      {/* Filter & Baseline Summary Strip */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-[#E4E1D6] bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(23,28,25,0.03)] text-xs">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10.5px] font-semibold uppercase tracking-wide text-[#5C6660]">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className="block text-[10.5px] font-semibold uppercase tracking-wide text-[#5C6660]">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className="block text-[10.5px] font-semibold uppercase tracking-wide text-[#5C6660]">Compare Year A</label>
            <select value={yearA} onChange={(e) => setYearASel(Number(e.target.value))} className={fieldCls}>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10.5px] font-semibold uppercase tracking-wide text-[#5C6660]">Compare Year B</label>
            <select value={yearB} onChange={(e) => setYearBSel(Number(e.target.value))} className={fieldCls}>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => onReloadWithYears(startDate, endDate, yearA, yearB)}
            disabled={loading}
            className="rounded-md bg-[#154734] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#0E291E] disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Updating...' : 'Apply Range'}
          </button>
        </div>

        <div className="flex items-center gap-4 border-l border-[#EFECE4] pl-4 text-[11px] text-[#5C6660]">
          <div>
            <span>Multi-Year Rain Mean</span>
            <div className="font-mono text-xs font-semibold text-[#171C19]">
              {climate.baseline_annual_rainfall_mm ? `${Math.round(climate.baseline_annual_rainfall_mm).toLocaleString()} mm/yr` : '—'}
            </div>
          </div>
          <div>
            <span>Mean T2M Baseline</span>
            <div className="font-mono text-xs font-semibold text-[#171C19]">
              {climate.baseline_annual_temp_c ? `${climate.baseline_annual_temp_c.toFixed(1)} °C` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Annual Precipitation + Year-over-Year Monthly */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          title="Annual Precipitation & Rainfall Anomaly"
          subtitle="Annual PRECTOTCORR totals vs complete-year multi-year climatology"
          right={<OriginBadge origin="live_retrieved" />}
        >
          <div className="h-68 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={climate.annual_series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#ECEAE1" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5C6660' }} />
                <YAxis yAxisId="rain" width={46} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: '#5C6660' }} />
                <YAxis
                  yAxisId="anom"
                  orientation="right"
                  width={46}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10.5, fill: '#B7791F' }}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar yAxisId="rain" dataKey="total_rainfall_mm" name="Annual Rain (mm)" fill="#1E4E68" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Line
                  yAxisId="anom"
                  type="monotone"
                  dataKey="rainfall_anomaly_mm"
                  name="Anomaly (mm)"
                  stroke="#B7791F"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#B7791F' }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title={`Monthly Year-over-Year (${climate.year_comparison?.year_a} vs ${climate.year_comparison?.year_b})`}
          subtitle="Monthly totals overlaid with multi-year seasonal norm"
          right={<OriginBadge origin="live_retrieved" />}
        >
          <div className="h-68 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={climate.year_comparison?.months || []} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#ECEAE1" vertical={false} />
                <XAxis dataKey="month_label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5C6660' }} />
                <YAxis axisLine={false} width={44} tickLine={false} tick={{ fontSize: 10.5, fill: '#5C6660' }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="year_a_rainfall_mm" name={`${climate.year_comparison?.year_a} Rain (mm)`} fill="#8FB3C9" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="year_b_rainfall_mm" name={`${climate.year_comparison?.year_b} Rain (mm)`} fill="#154734" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="baseline_rainfall_mm"
                  name="Climatology Mean (mm)"
                  stroke="#B7791F"
                  strokeDasharray="4 3"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Row 2: Temperature Trends + Soil Moisture */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          title="Air Temperature & Monthly Anomaly"
          subtitle="NASA POWER 2 m mean & peak daytime temperature (°C)"
          right={<OriginBadge origin="live_retrieved" />}
        >
          <div className="h-68 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={recentMonthly} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#ECEAE1" vertical={false} />
                <XAxis dataKey="year_month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#5C6660' }} />
                <YAxis yAxisId="t" domain={['auto', 'auto']} width={44} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: '#5C6660' }} />
                <YAxis yAxisId="a" orientation="right" width={40} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: '#B7791F' }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <ReferenceLine yAxisId="a" y={0} stroke="#C8C4B8" strokeDasharray="3 3" />
                <Line yAxisId="t" type="monotone" dataKey="max_temp_c" name="Peak Tmax (°C)" stroke="#C05621" dot={false} strokeWidth={1.8} isAnimationActive={false} />
                <Line yAxisId="t" type="monotone" dataKey="mean_temp_c" name="Mean T2M (°C)" stroke="#171C19" dot={false} strokeWidth={2} isAnimationActive={false} />
                <Bar yAxisId="a" dataKey="temp_anomaly_c" name="Temp Anomaly (°C)" fill="#D97706" fillOpacity={0.45} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Root-Zone Wetness & Standardized Moisture Anomaly"
          subtitle={climate.water_balance_note}
          right={<OriginBadge origin="live_retrieved" />}
        >
          <div className="h-68 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={recentMonthly} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#ECEAE1" vertical={false} />
                <XAxis dataKey="year_month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#5C6660' }} />
                <YAxis yAxisId="wet" domain={[0, 1]} width={38} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: '#5C6660' }} />
                <YAxis yAxisId="z" orientation="right" width={40} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: '#5C6660' }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <ReferenceLine yAxisId="z" y={0} stroke="#C8C4B8" strokeDasharray="3 3" />
                <Line yAxisId="wet" type="monotone" dataKey="mean_gwettop" name="Surface Wetness (0–1)" stroke="#2B6CB0" dot={false} strokeWidth={1.8} isAnimationActive={false} />
                <Line yAxisId="wet" type="monotone" dataKey="mean_gwetroot" name="Root-Zone Wetness (0–1)" stroke="#154734" dot={false} strokeWidth={2.2} isAnimationActive={false} />
                <Bar yAxisId="z" dataKey="std_soil_moisture_anomaly" name="Std Anomaly (z)" fill="#78827B" fillOpacity={0.35} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Row 3: MODIS Vegetation Series + Seasonal Anomalies */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Panel
          className="xl:col-span-7"
          title="QA-Filtered Satellite Vegetation Trajectory"
          subtitle={`${vegetation.primary_source} · ${vegetation.valid_observations} QA-valid composites`}
          right={<OriginBadge origin="historical_satellite" />}
        >
          {vegetation.series && vegetation.series.length > 0 ? (
            <div className="h-68 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vegetation.series} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="#ECEAE1" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#5C6660' }} />
                  <YAxis domain={[-0.1, 1]} width={38} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: '#5C6660' }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="ndvi" name="NDVI (250 m QA-filtered)" stroke="#154734" strokeWidth={2.1} dot={{ r: 2, fill: '#154734' }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="evi" name="EVI (250 m QA-filtered)" stroke="#2B6CB0" strokeWidth={1.7} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-[#5C6660]">No QA-valid MODIS observations found in range.</div>
          )}
        </Panel>

        <Panel
          className="xl:col-span-5"
          title="Seasonal Anomalies & Partial Water Balance"
          subtitle="Observed seasonal rainfall vs matching-season climatology"
        >
          <div className="max-h-68 overflow-y-auto pr-1">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#E4E1D6] text-[10.5px] font-semibold uppercase tracking-wide text-[#5C6660]">
                  <th className="py-2 pr-2">Season</th>
                  <th className="py-2 px-2">Rain</th>
                  <th className="py-2 px-2">Anomaly</th>
                  <th className="py-2 pl-2 text-right">P − ET*</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4] tabular-nums">
                {seasonal
                  .slice()
                  .reverse()
                  .map((s, idx) => (
                    <tr key={`${s.season_year}-${s.season}-${idx}`} className="hover:bg-[#FAF9F5]">
                      <td className="py-2 pr-2 text-[11px]">
                        <span className="font-mono font-semibold text-[#171C19]">{s.season_year}</span>{' '}
                        <span className="text-[#5C6660]">{s.season.split('(')[0].trim()}</span>
                      </td>
                      <td className="py-2 px-2 text-[#171C19]">{s.rainfall_mm !== null ? `${Math.round(s.rainfall_mm)} mm` : '—'}</td>
                      <td
                        className={`py-2 px-2 font-mono text-[11px] font-semibold ${
                          (s.rainfall_anomaly_mm || 0) < -150
                            ? 'text-[#991B1B]'
                            : (s.rainfall_anomaly_mm || 0) > 150
                              ? 'text-[#1E4E68]'
                              : 'text-[#5C6660]'
                        }`}
                      >
                        {s.rainfall_anomaly_mm !== null
                          ? `${s.rainfall_anomaly_mm >= 0 ? '+' : ''}${Math.round(s.rainfall_anomaly_mm)}`
                          : '—'}
                      </td>
                      <td className="py-2 pl-2 text-right font-mono text-[11px] text-[#333B36]">
                        {s.partial_water_balance_mm !== null ? `${Math.round(s.partial_water_balance_mm)} mm` : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
