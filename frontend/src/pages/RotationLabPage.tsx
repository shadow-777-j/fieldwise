import { useState } from 'react';
import { Award, Ban, CheckCircle2, Info, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip } from '../components/ChartTooltip';
import { EmptyOrErrorState, OriginBadge, Panel } from '../components/ui';
import type { Farm, RotationScenariosResponse, RotationWeights } from '../types/fieldwise';

const DEFAULT_WEIGHTS: RotationWeights = {
  water_sustainability: 25,
  soil_improvement: 25,
  climate_resilience: 20,
  economic_potential: 15,
  erosion_protection: 10,
  farmer_preference: 5,
};

const WEIGHT_LABELS: { key: keyof RotationWeights; label: string }[] = [
  { key: 'water_sustainability', label: 'Water Sustainability' },
  { key: 'soil_improvement', label: 'Soil Improvement' },
  { key: 'climate_resilience', label: 'Climate Resilience' },
  { key: 'economic_potential', label: 'Economic Potential' },
  { key: 'erosion_protection', label: 'Erosion Protection' },
  { key: 'farmer_preference', label: 'Farmer Preference' },
];

const STRATEGY_COLORS = ['#154734', '#1E4E68', '#B7791F', '#64748B'];

export function RotationLabPage({
  farm,
  rotationResult,
  loading,
  onEvaluate,
}: {
  farm: Farm | null;
  rotationResult: RotationScenariosResponse | null;
  loading: boolean;
  onEvaluate: (weights: RotationWeights) => void;
}) {
  const [weights, setWeights] = useState<RotationWeights>(DEFAULT_WEIGHTS);

  if (!farm) {
    return <EmptyOrErrorState title="No Farm Selected" message="Select a farm to compare rotation candidates in Rotation Lab." />;
  }

  const totalRaw = Object.values(weights).reduce((acc, v) => acc + v, 0);
  const eligible = (rotationResult?.scenarios || []).filter((s) => s.eligible);
  const excluded = (rotationResult?.scenarios || []).filter((s) => !s.eligible);

  const radarData = WEIGHT_LABELS.map(({ key, label }) => {
    const row: Record<string, string | number> = { criterion: label };
    eligible.forEach((sc, idx) => {
      row[`s${idx}`] = sc.criteria_scores[key];
    });
    return row;
  });

  const barData = eligible.map((sc) => ({
    name: sc.strategy_group.split('·')[0].trim() + ' · ' + sc.name.slice(0, 20) + (sc.name.length > 20 ? '…' : ''),
    score: sc.final_score ?? 0,
    water: sc.criteria_scores.water_sustainability,
    soil: sc.criteria_scores.soil_improvement,
    climate: sc.criteria_scores.climate_resilience,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E4E1D6] bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(23,28,25,0.03)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-[#171C19]">Rotation Lab — Hybrid Deterministic Decision Engine</h2>
            <OriginBadge origin="model_derived" />
          </div>
          <p className="mt-0.5 text-xs text-[#5C6660]">
            Hard biological and hydrological constraints execute before multi-criteria weighting. Preference weights never override salinity or flooding exclusions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onEvaluate(weights)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#154734] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0E291E] disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Evaluating...' : 'Recalculate Rankings'}</span>
        </button>
      </div>

      {/* Multi-Criteria Weight Tuners */}
      <Panel
        title="Decision Criterion Weighting"
        subtitle={`Normalized Σ(Criterion × Weight) · Active sum: ${totalRaw.toFixed(0)} raw units`}
        right={
          <button
            type="button"
            onClick={() => {
              setWeights(DEFAULT_WEIGHTS);
              onEvaluate(DEFAULT_WEIGHTS);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-[#E4E1D6] bg-[#FAF9F5] px-2.5 py-1 text-xs font-medium text-[#171C19] hover:bg-white cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" /> Reset 25/25/20/15/10/5
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {WEIGHT_LABELS.map(({ key, label }) => {
            const normPct = totalRaw > 0 ? ((weights[key] / totalRaw) * 100).toFixed(1) : '0.0';
            return (
              <div key={key} className="flex flex-col justify-between rounded-md border border-[#EFECE4] bg-[#FAF9F5] p-3 text-xs">
                <div className="flex items-start justify-between gap-1.5 font-semibold text-[#171C19]">
                  <span className="text-[11px] leading-tight">{label}</span>
                  <span className="shrink-0 tabular-nums font-mono text-[11px] font-bold text-[#154734]">{normPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={weights[key]}
                  onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })}
                  className="fw-slider mt-2.5 w-full"
                />
              </div>
            );
          })}
        </div>
      </Panel>

      {!rotationResult ? (
        <EmptyOrErrorState
          title="Scenarios Ready to Evaluate"
          message="Click 'Recalculate Rankings' to apply hard agronomic filters and score eligible crop rotations."
          actionLabel="Evaluate Rotation Strategies"
          onAction={() => onEvaluate(weights)}
        />
      ) : (
        <>
          {rotationResult.recommended_strategy && (
            <div className="rounded-lg border border-[#C6E3D2] bg-[#F3F8F5] p-5 shadow-[0_1px_2px_rgba(23,28,25,0.03)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 max-w-4xl">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#154734]">
                    <Award className="h-3.5 w-3.5" /> Recommended Strategy · {rotationResult.recommended_strategy.strategy_group}
                  </div>
                  <h3 className="text-base font-bold tracking-[-0.01em] text-[#171C19]">
                    {rotationResult.recommended_strategy.name}
                  </h3>
                  <p className="text-xs leading-relaxed text-[#333B36]">
                    {rotationResult.recommended_strategy.explanation.summary}
                  </p>
                </div>
                <div className="rounded-md border border-[#C6E3D2] bg-white px-4 py-2.5 text-center shadow-xs">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5C6660]">Composite Score</div>
                  <div className="tabular-nums text-2xl font-bold text-[#154734]">
                    {rotationResult.recommended_strategy.final_score}
                    <span className="text-xs font-normal text-[#78827B]">/100</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Radar & Ranked Pillars */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Panel title="Multi-Criteria Footprint" subtitle="Criterion sub-scores (0–100) across eligible candidates">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    data={radarData}
                    cx="50%"
                    cy="44%"
                    outerRadius="62%"
                    margin={{ top: 12, right: 24, bottom: 28, left: 24 }}
                  >
                    <PolarGrid stroke="#E4E1D6" />
                    <PolarAngleAxis dataKey="criterion" tick={{ fontSize: 10.5, fill: '#171C19' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9.5, fill: '#5C6660' }} />
                    {eligible.map((sc, idx) => (
                      <Radar
                        key={sc.id}
                        name={sc.strategy_group}
                        dataKey={`s${idx}`}
                        stroke={STRATEGY_COLORS[idx % STRATEGY_COLORS.length]}
                        fill={STRATEGY_COLORS[idx % STRATEGY_COLORS.length]}
                        fillOpacity={0.12}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Tooltip content={<ChartTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Overall Weighted Score & Core Pillars" subtitle="Eligible strategies ranked 0–100">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 12, left: 0, bottom: 5 }}>
                    <CartesianGrid stroke="#ECEAE1" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#5C6660' }} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10.5, fill: '#5C6660' }} />
                    <Tooltip content={<ChartTooltip valueSuffix="/100" />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="score" name="Final Score" fill="#154734" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="water" name="Water" fill="#1E4E68" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="soil" name="Soil" fill="#3B8260" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="climate" name="Climate" fill="#B7791F" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Eligible Scenario Rationale Cards */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {eligible.map((sc, idx) => (
              <Panel
                key={sc.id}
                title={sc.strategy_group}
                subtitle={sc.season_calendar}
                right={
                  <span className="tabular-nums rounded-md bg-[#154734] px-2.5 py-1 font-mono text-xs font-bold text-white">
                    {sc.final_score}/100
                  </span>
                }
                className={idx === 0 ? 'border-[#154734]/50 ring-1 ring-[#154734]/15' : ''}
              >
                <div className="space-y-3 text-xs">
                  <div className="font-bold text-sm text-[#171C19] leading-snug">{sc.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#C6E3D2] bg-[#F3F8F5] px-2 py-0.5 text-[11px] font-medium text-[#154734]">
                      <CheckCircle2 className="h-3 w-3" /> {sc.status}
                    </span>
                    <span className="rounded-md border border-[#E4E1D6] bg-[#FAF9F5] px-2 py-0.5 font-mono text-[11px] text-[#5C6660]">
                      {sc.duration_days} d
                    </span>
                  </div>
                  <p className="text-[#464F49] leading-relaxed">{sc.explanation.summary}</p>

                  {sc.explanation.positive_drivers.length > 0 && (
                    <div className="border-t border-[#EFECE4] pt-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#154734]">Positive Drivers</div>
                      <ul className="mt-1 list-disc pl-4 space-y-1 text-[#171C19]">
                        {sc.explanation.positive_drivers.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sc.explanation.risk_penalties.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#854D0E]">Tradeoffs / Risks</div>
                      <ul className="mt-1 list-disc pl-4 space-y-1 text-[#6B460B]">
                        {sc.explanation.risk_penalties.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sc.unknown_checks.length > 0 && (
                    <div className="rounded-md border border-[#ECD9AE] bg-[#FBF6EA] p-2.5 text-[11px] text-[#6B460B]">
                      <strong>Field Validation Needed:</strong> {sc.unknown_checks.join(' ')}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 border-t border-[#EFECE4] pt-2.5 text-[11px] text-[#5C6660]">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#154734]" />
                    <span>{sc.evidence_status}</span>
                  </div>
                </div>
              </Panel>
            ))}
          </div>

          {excluded.length > 0 && (
            <Panel
              title="Agronomically Excluded Candidates (Hard Constraints Enforced)"
              subtitle="Eliminated before scoring — cannot be promoted by farmer weight adjustments"
            >
              <div className="space-y-3">
                {excluded.map((ex) => (
                  <div
                    key={ex.id}
                    className="rounded-md border border-[#EFECE4] border-l-4 border-l-[#B91C1C] bg-[#FDF7F6] p-4 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold text-[#7F1D1D]">
                        <Ban className="h-4 w-4 text-[#B91C1C]" />
                        <span>{ex.name}</span>
                      </div>
                      <span className="rounded-md border border-[#F2CECA] bg-white px-2 py-0.5 font-mono text-[10.5px] font-semibold text-[#991B1B]">
                        EXCLUDED · NOT SCORED
                      </span>
                    </div>
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-[#4B1A1A]">
                      {ex.exclusion_reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Full 11-Attribute Scorecard */}
          <Panel
            title="Agronomic & Sustainability Comparative Matrix"
            subtitle="Side-by-side criterion ledger across candidate and baseline rotations"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1D6] bg-[#FAF9F5] text-[11px] font-semibold text-[#171C19]">
                    <th className="sticky left-0 bg-[#FAF9F5] p-3">Criterion</th>
                    {rotationResult.scenarios.map((sc) => (
                      <th key={sc.id} className="p-3 min-w-[180px]">
                        <div>{sc.strategy_group}</div>
                        <div className="mt-0.5 font-normal text-[#5C6660]">{sc.crops[0]}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE4] tabular-nums">
                  <tr>
                    <td className="sticky left-0 bg-white p-3 font-semibold text-[#171C19]">Weighted Score</td>
                    {rotationResult.scenarios.map((sc) => (
                      <td key={sc.id} className="p-3 font-mono font-bold text-[#154734]">
                        {sc.final_score !== null ? `${sc.final_score}/100` : 'Excluded'}
                      </td>
                    ))}
                  </tr>
                  {[
                    ['Water Requirement', (s: (typeof rotationResult.scenarios)[0]) => `${s.comparison_attributes.water_requirement_mm} mm/cycle`],
                    ['Soil Improvement Score', (s: (typeof rotationResult.scenarios)[0]) => `${s.comparison_attributes.soil_improvement_score}/100`],
                    ['Biological N Fixation', (s: (typeof rotationResult.scenarios)[0]) => `${s.comparison_attributes.nitrogen_fixation_kg_ha} kg N/ha`],
                    ['Organic Matter Addition', (s: (typeof rotationResult.scenarios)[0]) => s.comparison_attributes.organic_matter_contribution],
                    ['Seasonal Calendar Match', (s: (typeof rotationResult.scenarios)[0]) => s.comparison_attributes.growing_season_compatibility],
                    ['Salinity Tolerance', (s: (typeof rotationResult.scenarios)[0]) => s.comparison_attributes.salinity_tolerance],
                    ['Waterlogging Tolerance', (s: (typeof rotationResult.scenarios)[0]) => s.comparison_attributes.waterlogging_tolerance],
                    ['Pest-Cycle Interruption', (s: (typeof rotationResult.scenarios)[0]) => s.comparison_attributes.pest_cycle_interruption],
                    ['Erosion Protection', (s: (typeof rotationResult.scenarios)[0]) => `${s.comparison_attributes.erosion_protection_score}/100`],
                    ['Market / Income Fit', (s: (typeof rotationResult.scenarios)[0]) => `${s.comparison_attributes.economic_potential_score}/100`],
                    ['Farmer Preference Fit', (s: (typeof rotationResult.scenarios)[0]) => `${s.comparison_attributes.farmer_preference_score}/100`],
                  ].map(([label, getter]) => (
                    <tr key={String(label)} className="hover:bg-[#FAF9F5]">
                      <td className="sticky left-0 bg-white p-3 font-medium text-[#333B36]">{String(label)}</td>
                      {rotationResult.scenarios.map((sc) => (
                        <td key={sc.id} className="p-3 text-[11.5px] text-[#333B36] capitalize">
                          {(getter as (x: typeof sc) => string)(sc)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-[#5C6660]">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>{rotationResult.formula}</span>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
