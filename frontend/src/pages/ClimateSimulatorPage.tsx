import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, Sliders } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '../components/ChartTooltip';
import { EmptyOrErrorState, OriginBadge, Panel } from '../components/ui';
import { api } from '../services/api';
import type { ClimateSimulationResponse, Farm } from '../types/fieldwise';

export function ClimateSimulatorPage({ farm }: { farm: Farm | null }) {
  const [rainDelta, setRainDelta] = useState(0);
  const [tempDelta, setTempDelta] = useState(0);
  const [waterDelta, setWaterDelta] = useState(0);
  const [shiftDays, setShiftDays] = useState(0);
  const [simResult, setSimResult] = useState<ClimateSimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async (r = rainDelta, t = tempDelta, w = waterDelta, s = shiftDays) => {
    if (!farm) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.runClimateSimulation(farm.id, {
        rainfall_delta_pct: r,
        temperature_delta_c: t,
        water_availability_delta_pct: w,
        season_shift_days: s,
      });
      setSimResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (farm) {
      runSimulation(0, 0, 0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm?.id]);

  if (!farm) {
    return (
      <EmptyOrErrorState
        title="No Farm Selected"
        message="Select a farm to run hypothetical climate sensitivity modeling."
      />
    );
  }

  const applyPreset = (r: number, t: number, w: number, s: number) => {
    setRainDelta(r);
    setTempDelta(t);
    setWaterDelta(w);
    setShiftDays(s);
    runSimulation(r, t, w, s);
  };

  const chartData = (simResult?.scenarios || []).map((sc) => ({
    name: sc.strategy_group.split('·')[0].trim(),
    baseline: sc.baseline_score ?? 0,
    simulated: sc.final_score ?? 0,
    excluded: !sc.eligible,
  }));

  return (
    <div className="space-y-5">
      {/* Editorial Hypothetical Disclaimer */}
      <div className="flex items-start gap-3 rounded-lg border border-[#F2CECA] border-l-4 border-l-[#B91C1C] bg-[#FDF7F6] px-4 py-3 text-xs text-[#6B1A1A]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" />
        <div>
          <div className="font-bold uppercase tracking-[0.04em] text-[#7F1D1D]">
            User-Defined Hypothetical Scenario — Not an Official NASA Forecast
          </div>
          <p className="mt-0.5 text-[#5C3A3A] leading-relaxed">
            Adjustments perturb retrieved NASA POWER baselines to test crop-rotation robustness under hypothetical weather stress. These controls do not represent CMIP6 projections or official NASA forecasts.
          </p>
        </div>
      </div>

      {/* Controls Bench */}
      <Panel
        title="Climate Perturbation Workbench"
        subtitle="Adjust seasonal rainfall, mean temperature, water supply, and monsoon onset shift"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge origin="hypothetical_simulation" />
            <button
              type="button"
              onClick={() => applyPreset(0, 0, 0, 0)}
              className="inline-flex items-center gap-1 rounded-md border border-[#E4E1D6] bg-[#FAF9F5] px-2.5 py-1 text-xs font-medium text-[#171C19] hover:bg-white cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> Reset 0%
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          {[
            {
              label: 'Rainfall Shift',
              display: `${rainDelta >= 0 ? '+' : ''}${rainDelta}%`,
              tone: 'text-[#154734]',
              min: -20,
              max: 20,
              step: 2,
              value: rainDelta,
              onChange: setRainDelta,
              ticks: ['-20%', '0%', '+20%'],
            },
            {
              label: 'Temperature Shift',
              display: `${tempDelta >= 0 ? '+' : ''}${tempDelta.toFixed(1)}°C`,
              tone: 'text-[#B7791F]',
              min: -1,
              max: 3,
              step: 0.5,
              value: tempDelta,
              onChange: setTempDelta,
              ticks: ['-1.0°C', '0°C', '+3.0°C'],
            },
            {
              label: 'Water Availability',
              display: `${waterDelta >= 0 ? '+' : ''}${waterDelta}%`,
              tone: 'text-[#1E4E68]',
              min: -30,
              max: 30,
              step: 5,
              value: waterDelta,
              onChange: setWaterDelta,
              ticks: ['-30%', '0%', '+30%'],
            },
            {
              label: 'Season Onset Shift',
              display: `${shiftDays >= 0 ? '+' : ''}${shiftDays} d`,
              tone: 'text-[#171C19]',
              min: -30,
              max: 30,
              step: 5,
              value: shiftDays,
              onChange: setShiftDays,
              ticks: ['-30 d', '0 d', '+30 d'],
            },
          ].map((ctrl) => (
            <div key={ctrl.label} className="rounded-md border border-[#EFECE4] bg-[#FAF9F5] p-3.5">
              <div className="flex justify-between font-semibold text-[#171C19]">
                <span>{ctrl.label}</span>
                <span className={`font-mono ${ctrl.tone}`}>{ctrl.display}</span>
              </div>
              <input
                type="range"
                min={ctrl.min}
                max={ctrl.max}
                step={ctrl.step}
                value={ctrl.value}
                onChange={(e) => ctrl.onChange(Number(e.target.value))}
                className="fw-slider mt-3 w-full"
              />
              <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[#78827B]">
                {ctrl.ticks.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFECE4] pt-4">
          <div className="flex flex-wrap gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => applyPreset(-18, 2.5, -25, 20)}
              className="rounded-md border border-[#E4E1D6] bg-[#FAF9F5] px-2.5 py-1.5 font-medium text-[#171C19] hover:bg-white cursor-pointer"
            >
              Preset: Dry Heat Stress (−18% Rain, +2.5°C, −25% Water)
            </button>
            <button
              type="button"
              onClick={() => applyPreset(20, 1.0, 15, -15)}
              className="rounded-md border border-[#E4E1D6] bg-[#FAF9F5] px-2.5 py-1.5 font-medium text-[#171C19] hover:bg-white cursor-pointer"
            >
              Preset: Intensified Monsoon (+20% Rain, +1.0°C)
            </button>
          </div>
          <button
            type="button"
            onClick={() => runSimulation()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#171C19] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#2A322E] disabled:opacity-60 cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>{loading ? 'Recalculating...' : 'Run Sensitivity Check'}</span>
          </button>
        </div>
      </Panel>

      {error && <EmptyOrErrorState title="Simulation Error" message={error} isError />}

      {simResult && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <Panel
            className="xl:col-span-6"
            title="Baseline vs Hypothetical Suitability"
            subtitle="Comparison of strategy composite scores under selected perturbations"
          >
            <div className="h-68 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#ECEAE1" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5C6660' }} />
                  <YAxis domain={[0, 100]} width={36} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: '#5C6660' }} />
                  <Tooltip content={<ChartTooltip valueSuffix="/100" />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="baseline" name="Baseline Score" fill="#C4C0B3" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="simulated" name="Simulated Score" fill="#154734" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel
            className="xl:col-span-6"
            title="Score Shifts & New Biological Barriers"
            subtitle={`Simulated Top Candidate: ${simResult.simulated_top_strategy?.name || 'None Eligible'}`}
          >
            <div className="space-y-2.5">
              {simResult.scenarios.map((sc) => (
                <div key={sc.id} className="rounded-md border border-[#EFECE4] bg-[#FAF9F5] p-3.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-[#171C19]">{sc.strategy_group}</span>
                      <div className="text-[#464F49] truncate max-w-md">{sc.name}</div>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      {sc.eligible ? (
                        <>
                          <span className="font-mono text-sm font-bold text-[#171C19]">{sc.final_score}/100</span>
                          {sc.score_delta !== null && sc.score_delta !== undefined && (
                            <span
                              className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                                sc.score_delta > 0
                                  ? 'bg-[#ECF6F0] text-[#155E3A]'
                                  : sc.score_delta < 0
                                    ? 'bg-[#FDF1F1] text-[#991B1B]'
                                    : 'bg-[#ECEAE1] text-[#5C6660]'
                              }`}
                            >
                              {sc.score_delta > 0 ? `+${sc.score_delta}` : sc.score_delta}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="rounded-md bg-[#FDF1F1] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#991B1B]">
                          Excluded
                        </span>
                      )}
                    </div>
                  </div>
                  {sc.warnings.length > 0 && <div className="mt-1.5 text-[11px] text-[#854D0E]">{sc.warnings.join(' ')}</div>}
                  {sc.exclusion_reasons.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-[#991B1B]">{sc.exclusion_reasons.join(' ')}</div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
