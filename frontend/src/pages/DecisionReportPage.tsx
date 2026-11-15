import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { EmptyOrErrorState, OriginBadge, RiskBadge } from '../components/ui';
import { api } from '../services/api';
import type { Farm } from '../types/fieldwise';

type ReportPreview = Awaited<ReturnType<typeof api.previewDecisionReport>>;

export function DecisionReportPage({ farm }: { farm: Farm | null }) {
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = async () => {
    if (!farm) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.previewDecisionReport(farm.id);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build report preview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (farm) {
      loadPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm?.id]);

  if (!farm) {
    return (
      <EmptyOrErrorState
        title="No Farm Selected"
        message="Select a field to generate and download a scientific PDF Decision Report."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Utility Export Strip */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E4E1D6] bg-white px-5 py-3.5 shadow-[0_1px_2px_rgba(23,28,25,0.03)]">
        <div>
          <h2 className="text-sm font-bold text-[#171C19]">Agricultural Decision Report Generator</h2>
          <p className="mt-0.5 text-xs text-[#5C6660]">
            Compiles field boundaries, verified NASA dataset provenance, vulnerabilities, rotation matrix, and extension advice into A4 PDF.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPreview}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E1D6] bg-[#FAF9F5] px-3 py-2 text-xs font-semibold text-[#171C19] hover:bg-white cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Sheet</span>
          </button>
          <a
            href={api.getDecisionReportDownloadUrl(farm.id)}
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-[#154734] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0E291E]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download PDF Report</span>
          </a>
        </div>
      </div>

      {error && <EmptyOrErrorState title="Report Preview Error" message={error} isError />}

      {loading && !preview && (
        <div className="mx-auto max-w-5xl rounded-lg border border-[#E4E1D6] bg-white p-10 text-center text-xs text-[#5C6660]">
          Compiling NASA observations, vulnerability scores, and rotation scorecards into A4 document...
        </div>
      )}

      {/* A4 Document Paper Preview Sheet */}
      {preview && (
        <article className="mx-auto max-w-5xl rounded-lg border border-[#D8D4C8] bg-white p-6 sm:p-9 shadow-[0_6px_28px_rgba(23,28,25,0.06)] space-y-8">
          {/* Document Masthead */}
          <header className="border-b-2 border-[#154734] pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#154734]">
                FIELDWISE AI · AGRONOMIC INTELLIGENCE BRIEF
              </span>
              <span className="font-mono text-[11px] text-[#5C6660]">
                Period: {preview.farm.analysis_start_date} – {preview.farm.analysis_end_date}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#171C19]">{preview.farm.name}</h1>
            <p className="mt-0.5 text-xs text-[#5C6660]">
              {preview.farm.region} · {preview.farm.centroid_lat.toFixed(5)}°N, {preview.farm.centroid_lon.toFixed(5)}°E ·{' '}
              {preview.farm.area_hectares.toFixed(2)} ha
            </p>
          </header>

          {/* 01 / Executive Summary */}
          <section className="space-y-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5C6660]">
              01 / Executive Field Summary
            </div>
            <div className="grid grid-cols-1 gap-4 rounded-md border border-[#EFECE4] bg-[#FAF9F5] p-4 md:grid-cols-3 text-xs">
              <div>
                <div className="text-[11px] text-[#5C6660]">Parcel Area & SRTM</div>
                <div className="mt-1 font-bold text-[#171C19]">
                  {preview.farm.area_hectares.toFixed(2)} ha · {preview.farm.elevation_m !== null ? `${preview.farm.elevation_m.toFixed(1)} m ASL` : 'Pending'}
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-[#5C6660]">
                  System: {preview.farm.farming_system.replace(/_/g, ' ')}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#5C6660]">Top-Ranked Rotation Strategy</div>
                <div className="mt-1 font-bold text-[#154734]">
                  {preview.scenarios_bundle.recommended_strategy?.name || 'None Eligible'}
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-[#171C19]">
                  Weighted Score: {preview.scenarios_bundle.recommended_strategy?.final_score ?? 'N/A'} / 100
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#5C6660]">Assessment Confidence</div>
                <div className="mt-1 font-bold text-[#171C19]">{preview.vulnerabilities.overall_confidence}</div>
                <div className="mt-0.5 text-[10.5px] text-[#5C6660]">
                  Soil Data Origin: {preview.soil?.data_origin || 'Not Recorded'}
                </div>
              </div>
            </div>
          </section>

          {/* 02 / Provenance Table */}
          <section className="space-y-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5C6660]">
              02 / NASA &amp; Satellite Dataset Provenance
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1D6] text-[10.5px] font-semibold uppercase tracking-wide text-[#5C6660]">
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 px-2">Product Identifier</th>
                    <th className="py-2 px-2">Native Resolution</th>
                    <th className="py-2 px-2">Origin</th>
                    <th className="py-2 pl-2">Status / Gaps</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE4]">
                  {preview.provenance.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-3 font-semibold text-[#171C19]">{p.source_name}</td>
                      <td className="py-2.5 px-2 font-mono text-[11px] text-[#464F49]">{p.product_identifier}</td>
                      <td className="py-2.5 px-2 text-[#464F49]">{p.spatial_resolution}</td>
                      <td className="py-2.5 px-2">
                        <OriginBadge origin={p.data_origin} />
                      </td>
                      <td className="py-2.5 pl-2 text-[11px] text-[#5C6660]">{p.missing_data_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 03 & 04 / Vulnerabilities + Field Limitations */}
          <div className="grid grid-cols-1 gap-6 border-t border-[#EFECE4] pt-6 lg:grid-cols-2">
            <section className="space-y-3">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5C6660]">
                03 / Five-Component Risk Ledger
              </div>
              <div className="divide-y divide-[#EFECE4] rounded-md border border-[#EFECE4]">
                {preview.vulnerabilities.indicators.map((ind) => (
                  <div key={ind.id} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                    <span className="font-medium text-[#171C19]">{ind.name}</span>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-semibold text-[#171C19]">
                        {ind.index_score !== null ? `${ind.index_score.toFixed(1)}/100` : 'N/A'}
                      </span>
                      <RiskBadge category={ind.category} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5C6660]">
                04 / Scientific Limitations &amp; Extension Advice
              </div>
              <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed text-[#464F49]">
                <li>
                  Coarse NASA grids (POWER ~55 km, SMAP 9 km, GPM ~10 km) characterize regional meteorology and cannot differentiate adjacent smallholder plots.
                </li>
                <li>
                  Field soil chemistry (pH, EC, organic carbon, NPK) requires local soil laboratory testing rather than orbital inference.
                </li>
                <li>
                  Partial atmospheric water balance (P − ET) excludes tidal estuary inflow, bund sluice operation, and groundwater pumping.
                </li>
                <li>
                  Confirm cultivar selection and planting windows with local Krishi Bhavan / ICAR KVK extension agronomists prior to field adoption.
                </li>
              </ul>
            </section>
          </div>
        </article>
      )}
    </div>
  );
}
