import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Layers, Lock, Satellite } from 'lucide-react';
import { MapWorkspace, type BasemapMode } from '../components/MapWorkspace';
import { EmptyOrErrorState, OriginBadge, Panel } from '../components/ui';
import type { EarthObservationsResponse, Farm, GIBSLayer } from '../types/fieldwise';

export function EarthIntelligencePage({
  farms,
  selectedFarm,
  observations,
  loadingObs,
  onRefreshObservations,
}: {
  farms: Farm[];
  selectedFarm: Farm | null;
  observations: EarthObservationsResponse | null;
  loadingObs: boolean;
  onRefreshObservations: () => void;
}) {
  const [basemap, setBasemap] = useState<BasemapMode>('satellite');
  const [selectedLayerId, setSelectedLayerId] = useState<string>('modis_ndvi');
  const [opacity, setOpacity] = useState<number>(0.72);

  if (!selectedFarm) {
    return (
      <EmptyOrErrorState
        title="No Farm Selected"
        message="Select a field to inspect NASA GIBS satellite layers, USGS Landsat scenes, and dataset provenance."
      />
    );
  }

  const gibsLayers: GIBSLayer[] = observations?.gibs_layers || [];
  const gee = observations?.gee;
  const activeGIBS = gibsLayers.find((l) => l.id === selectedLayerId);
  const isLandsatLayer = selectedLayerId === 'landsat_gee';

  const overlayConfig =
    isLandsatLayer && gee?.authenticated && gee.landsat_tile_url
      ? { id: 'landsat_gee', tileUrl: gee.landsat_tile_url, maxZoom: 16, opacity }
      : activeGIBS
        ? { id: activeGIBS.id, tileUrl: activeGIBS.tile_url_template, maxZoom: activeGIBS.max_zoom, opacity }
        : null;

  return (
    <div className="space-y-5">
      {!observations && (
        <EmptyOrErrorState
          title="Satellite Layers Ready to Sync"
          message="Click Sync NASA Data to load live NASA GIBS WMTS dates, MODIS MOD13Q1 pixel history, EarthSearch Landsat 8/9 scenes, and SRTM terrain."
          actionLabel={loadingObs ? 'Syncing...' : 'Sync NASA Data'}
          onAction={onRefreshObservations}
        />
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-5">
          {/* Layer Strip & Opacity Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E4E1D6] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(23,28,25,0.03)]">
            <div className="flex flex-wrap items-center gap-1.5">
              {gibsLayers.map((layer) => {
                const active = selectedLayerId === layer.id;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setSelectedLayerId(layer.id)}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-[#154734] text-white shadow-xs'
                        : 'border border-[#E4E1D6] bg-[#FAF9F5] text-[#171C19] hover:border-[#C8C4B8] hover:bg-white'
                    }`}
                  >
                    {layer.name.replace('NASA ', '').replace(' (16-Day)', '').replace(' (Day, 8-Day)', '')}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedLayerId('landsat_gee')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  isLandsatLayer
                    ? 'bg-[#171C19] text-white shadow-xs'
                    : 'border border-[#E4E1D6] bg-[#FAF9F5] text-[#171C19] hover:border-[#C8C4B8] hover:bg-white'
                }`}
              >
                {!gee?.authenticated && <Lock className="h-3 w-3 text-[#B7791F]" />}
                <span>Landsat 8/9 (30 m)</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-2 text-[#5C6660]">
                <span className="font-medium">Opacity</span>
                <input
                  type="range"
                  min={0.15}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="fw-slider w-20"
                />
                <span className="font-mono text-[11px] w-7 text-[#171C19]">{Math.round(opacity * 100)}%</span>
              </label>
              <button
                type="button"
                onClick={() => setBasemap((b) => (b === 'satellite' ? 'standard' : 'satellite'))}
                className="rounded-md border border-[#E4E1D6] bg-[#FAF9F5] px-2.5 py-1 text-xs font-medium text-[#171C19] hover:bg-white cursor-pointer"
              >
                {basemap === 'satellite' ? 'Street Base' : 'Satellite Base'}
              </button>
            </div>
          </div>

          {/* Honest GEE Authentication Sheet */}
          {isLandsatLayer && !gee?.authenticated && (
            <div className="rounded-lg border border-[#E6D6B8] border-l-4 border-l-[#B7791F] bg-[#FBF7EE] p-4 text-xs text-[#573A08]">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B7791F]" />
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="font-bold text-[#171C19]">
                    Google Earth Engine Authentication Required for 30 m Landsat Rasters
                  </div>
                  <p className="text-[#464F49] leading-relaxed">
                    FIELDWISE AI never synthesizes Landsat pixel overlays without live GEE authorization. Current state:{' '}
                    <span className="font-mono font-semibold text-[#171C19]">{gee?.reason || 'Not configured'}</span>.
                    Overpass scene footprints below are queried directly from Element84 EarthSearch STAC.
                  </p>
                  <ul className="space-y-1 rounded-md bg-[#171C19] px-3 py-2.5 font-mono text-[11px] text-[#E6ECE8]">
                    {(gee?.setup_instructions || []).map((step, i) => (
                      <li key={i}>$ {step}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <MapWorkspace
            farms={farms}
            selectedFarm={selectedFarm}
            basemap={basemap}
            rasterOverlay={overlayConfig}
            heightClass="h-[450px]"
          />

          <Panel
            title="USGS Landsat 8/9 C2 Level 2 Overpass Catalog"
            subtitle="Live overpass scenes intersecting active field boundary (EarthSearch STAC · 30 m)"
            right={<OriginBadge origin="historical_satellite" />}
          >
            {observations?.landsat_stac.scenes && observations.landsat_stac.scenes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E1D6] text-[10.5px] font-semibold uppercase tracking-wide text-[#5C6660]">
                      <th className="py-2 pr-3">Acquisition</th>
                      <th className="py-2 px-2">Scene Identifier</th>
                      <th className="py-2 px-2">Sensor</th>
                      <th className="py-2 px-2">WRS</th>
                      <th className="py-2 pl-2">Scene Cloud Cover</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE4] tabular-nums">
                    {observations.landsat_stac.scenes.slice(0, 8).map((sc) => {
                      const pct = sc.cloud_cover_pct ?? 100;
                      const isClear = pct < 35;
                      return (
                        <tr key={sc.scene_id} className="hover:bg-[#FAF9F5]">
                          <td className="py-2 pr-3 font-mono text-[11px] font-semibold text-[#171C19]">{sc.date}</td>
                          <td className="py-2 px-2 font-mono text-[11px] text-[#5C6660]">{sc.scene_id}</td>
                          <td className="py-2 px-2 uppercase text-[11px] font-medium text-[#333B36]">{sc.platform}</td>
                          <td className="py-2 px-2 font-mono text-[11px] text-[#5C6660]">
                            {sc.wrs_path}/{sc.wrs_row}
                          </td>
                          <td className="py-2 pl-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-14 overflow-hidden rounded-full bg-[#EAE7DF]">
                                <div
                                  className={`h-full rounded-full ${isClear ? 'bg-[#1D7A4C]' : 'bg-[#8E9690]'}`}
                                  style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] text-[#171C19]">
                                {sc.cloud_cover_pct !== null ? `${sc.cloud_cover_pct.toFixed(1)}%` : '—'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-[#5C6660]">Sync NASA Data to query Landsat 8/9 scenes over this boundary.</p>
            )}
          </Panel>
        </div>

        {/* Layer Metadata & Resolution Honesty Inspector */}
        <div className="xl:col-span-4 space-y-5">
          <Panel
            title="Layer Specification"
            subtitle="Native resolution & radiative provenance"
            right={
              <OriginBadge
                origin={isLandsatLayer ? 'historical_satellite' : activeGIBS?.data_origin || 'live_retrieved'}
              />
            }
          >
            {isLandsatLayer ? (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="font-bold text-sm text-[#171C19]">USGS Landsat 8/9 Collection 2 Level 2</div>
                  <div className="font-mono text-[11px] text-[#5C6660] mt-0.5">
                    LANDSAT/LC08/C02/T1_L2 + LC09/C02/T1_L2
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3 border-y border-[#EFECE4] py-3">
                  <div>
                    <dt className="text-[10.5px] text-[#5C6660]">Spatial Resolution</dt>
                    <dd className="font-semibold text-[#171C19]">30 m (Plot Scale)</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] text-[#5C6660]">Combined Revisit</dt>
                    <dd className="font-semibold text-[#171C19]">8 days</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] text-[#5C6660]">Earth Engine</dt>
                    <dd className="font-semibold text-[#171C19]">{gee?.authenticated ? 'Connected' : 'Auth Required'}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] text-[#5C6660]">Cloud Filter</dt>
                    <dd className="font-semibold text-[#171C19]">QA_PIXEL Bitmask</dd>
                  </div>
                </dl>
                <p className="text-[#464F49] leading-relaxed">
                  Surface reflectance scaling: <code className="rounded bg-[#F3F2ED] px-1 py-0.5 font-mono text-[11px]">0.0000275 × DN − 0.2</code>.
                  NDVI computed from <code className="font-mono">SR_B5</code> &amp; <code className="font-mono">SR_B4</code>.
                </p>
              </div>
            ) : activeGIBS ? (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="font-bold text-sm text-[#171C19]">{activeGIBS.name}</div>
                  <div className="font-mono text-[11px] text-[#5C6660] mt-0.5 break-all">{activeGIBS.dataset_id}</div>
                </div>
                <dl className="grid grid-cols-2 gap-3 border-y border-[#EFECE4] py-3">
                  <div>
                    <dt className="text-[10.5px] text-[#5C6660]">Native Resolution</dt>
                    <dd className="font-semibold text-[#171C19]">{activeGIBS.spatial_resolution}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] text-[#5C6660]">Latest Date</dt>
                    <dd className="font-mono font-semibold text-[#171C19]">{activeGIBS.observation_date}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] text-[#5C6660]">Cadence</dt>
                    <dd className="font-semibold text-[#171C19]">{activeGIBS.temporal_resolution}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] text-[#5C6660]">Tile Feed</dt>
                    <dd className="inline-flex items-center gap-1 font-semibold text-[#154734]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Active WMTS
                    </dd>
                  </div>
                </dl>

                <p className="text-[#464F49] leading-relaxed">{activeGIBS.description}</p>

                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#5C6660] mb-2">
                    Radiance / Index Legend
                  </div>
                  <div className="space-y-1.5">
                    {activeGIBS.legend.map((item) => (
                      <div key={item.label} className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-5 rounded-xs border border-black/15 shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-[11px] text-[#333B36]">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-md border border-[#D3DFEC] bg-[#F2F6FA] p-3 text-[11px] text-[#1E3F66]">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Scale Honesty:</strong> Product ({activeGIBS.spatial_resolution}) renders at native sampling without artificial downscaling on {selectedFarm.area_hectares.toFixed(2)} ha fields.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#5C6660]">Sync NASA data to load GIBS WMTS specifications.</p>
            )}
          </Panel>

          <Panel title="SRTM 30m Elevation & Phase 2 Feeds" subtitle="Topographic context & extended hydrology">
            <div className="space-y-3 text-xs">
              {observations?.srtm.status === 'available' ? (
                <div className="rounded-md border border-[#EFECE4] bg-[#FAF9F5] p-3 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-[#171C19]">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-[#154734]" /> USGS SRTMGL1 (30 m)
                    </span>
                    <span className="font-mono text-[#154734]">{observations.srtm.summary.mean_elevation_m} m ASL</span>
                  </div>
                  <div className="text-[11px] text-[#5C6660]">
                    Range {observations.srtm.summary.min_elevation_m}–{observations.srtm.summary.max_elevation_m} m ·{' '}
                    {observations.srtm.summary.terrain_context}
                  </div>
                </div>
              ) : (
                <div className="text-[#5C6660]">SRTM elevation pending sync.</div>
              )}

              <div className="border-t border-[#EFECE4] pt-3 space-y-2 text-[11px] text-[#5C6660]">
                <div className="font-semibold text-[#171C19] flex items-center gap-1.5">
                  <Satellite className="h-3.5 w-3.5 text-[#154734]" /> Phase 2 Optional Integrations
                </div>
                <p>
                  <strong>ECOSTRESS LST / ET:</strong> Distributed via NASA AppEEARS (outside public GEE catalog).
                </p>
                <p>
                  <strong>GRACE / GRACE-FO:</strong>{' '}
                  <code className="font-mono text-[#171C19]">NASA/GRACE/MASS_GRIDS_V04/LAND</code> (~111 km regional water storage via GEE).
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
