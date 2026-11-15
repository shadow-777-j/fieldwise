import React, { useState } from 'react';
import { Check, Edit3, Map as MapIcon, Plus, RotateCcw, Satellite, Trash2, Upload } from 'lucide-react';
import area from '@turf/area';
import { MapWorkspace, type BasemapMode } from '../components/MapWorkspace';
import { OriginBadge, Panel } from '../components/ui';
import { api } from '../services/api';
import type { Farm, GeoJSONPolygon, PageId } from '../types/fieldwise';

const FARMING_SYSTEMS = [
  { value: 'pokkali_rice_prawn', label: 'Pokkali Rice–Prawn Coastal Tidal' },
  { value: 'conventional_rice_pulse', label: 'Conventional Rice–Pulse Plains' },
  { value: 'cereal_legume', label: 'Cereal–Legume Rotation' },
  { value: 'coastal_saline', label: 'Coastal Saline Wetland' },
  { value: 'upland_rainfed', label: 'Upland Rainfed Cropping' },
];

export function FarmExplorerPage({
  farms,
  selectedFarm,
  onSelectFarm,
  onFarmsChanged,
  onNavigate,
}: {
  farms: Farm[];
  selectedFarm: Farm | null;
  onSelectFarm: (id: string) => void;
  onFarmsChanged: (newSelectedId?: string) => Promise<void>;
  onNavigate: (page: PageId) => void;
}) {
  const [basemap, setBasemap] = useState<BasemapMode>('satellite');
  const [drawingMode, setDrawingMode] = useState(false);
  const [draftCoords, setDraftCoords] = useState<[number, number][]>([]);
  const [editingVertices, setEditingVertices] = useState(false);

  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newSystem, setNewSystem] = useState('conventional_rice_pulse');
  const [startDate, setStartDate] = useState('2018-01-01');
  const [endDate, setEndDate] = useState('2026-10-31');
  const [geojsonText, setGeojsonText] = useState('');
  const [showGeoJsonImport, setShowGeoJsonImport] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [editStart, setEditStart] = useState(selectedFarm?.analysis_start_date || '2018-01-01');
  const [editEnd, setEditEnd] = useState(selectedFarm?.analysis_end_date || '2026-10-31');

  const handleAddDraftPoint = (pt: [number, number]) => {
    setDraftCoords((prev) => [...prev, pt]);
  };

  const draftAreaHa =
    draftCoords.length >= 3
      ? area({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[...draftCoords, draftCoords[0]]] },
        }) / 10000
      : 0;

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    let geometryObj: Record<string, unknown>;

    if (geojsonText.trim()) {
      try {
        geometryObj = JSON.parse(geojsonText) as Record<string, unknown>;
      } catch {
        setStatusMsg({ type: 'err', text: 'Invalid JSON syntax in GeoJSON input.' });
        return;
      }
    } else if (draftCoords.length >= 3) {
      geometryObj = {
        type: 'Polygon',
        coordinates: [[...draftCoords, draftCoords[0]]],
      };
    } else {
      setStatusMsg({
        type: 'err',
        text: 'Plot at least 3 vertices on the satellite map or paste/upload a valid GeoJSON polygon.',
      });
      return;
    }

    if (!newName.trim() || !newRegion.trim()) {
      setStatusMsg({ type: 'err', text: 'Please provide both Farm Name and Region.' });
      return;
    }

    setBusy(true);
    try {
      const created = await api.createFarm({
        name: newName,
        region: newRegion,
        farming_system: newSystem,
        geometry_geojson: geometryObj,
        analysis_start_date: startDate,
        analysis_end_date: endDate,
      });
      setDrawingMode(false);
      setDraftCoords([]);
      setGeojsonText('');
      setNewName('');
      setNewRegion('');
      setStatusMsg({ type: 'ok', text: `Registered parcel '${created.name}' (${created.area_hectares.toFixed(2)} ha).` });
      await onFarmsChanged(created.id);
    } catch (err) {
      setStatusMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to create farm.' });
    } finally {
      setBusy(false);
    }
  };

  const handleUploadGeoJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setGeojsonText(String(reader.result || ''));
      setShowGeoJsonImport(true);
    };
    reader.readAsText(file);
  };

  const handleUpdateBoundary = async (geom: GeoJSONPolygon) => {
    if (!selectedFarm) return;
    setBusy(true);
    try {
      await api.updateFarm(selectedFarm.id, { geometry_geojson: geom as unknown as Record<string, unknown> });
      setStatusMsg({ type: 'ok', text: 'Updated parcel boundary geometry and recalculated geodesic area.' });
      await onFarmsChanged(selectedFarm.id);
    } catch (err) {
      setStatusMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to update boundary.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAnalysisWindow = async () => {
    if (!selectedFarm) return;
    setBusy(true);
    try {
      await api.updateFarm(selectedFarm.id, {
        analysis_start_date: editStart,
        analysis_end_date: editEnd,
      });
      setStatusMsg({ type: 'ok', text: `Updated analysis period (${editStart} to ${editEnd}).` });
      await onFarmsChanged(selectedFarm.id);
    } catch (err) {
      setStatusMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to update dates.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFarm = async (farmId: string) => {
    setBusy(true);
    try {
      await api.deleteFarm(farmId);
      setStatusMsg({ type: 'ok', text: 'Removed farm plot from database.' });
      await onFarmsChanged();
    } catch (err) {
      setStatusMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to delete farm.' });
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'mt-1 w-full rounded-md border border-[#D8D4C8] bg-[#FAF9F5] px-2.5 py-1.5 text-xs text-[#171C19] placeholder:text-[#8E9690] focus:border-[#154734] focus:bg-white focus:outline-none';

  return (
    <div className="space-y-4">
      {/* Workbench GIS Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E4E1D6] bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(23,28,25,0.03)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-[#E0DDD2] bg-[#EFEDE6] p-0.5">
            <button
              type="button"
              onClick={() => setBasemap('satellite')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                basemap === 'satellite' ? 'bg-white text-[#171C19] shadow-xs' : 'text-[#5C6660] hover:text-[#171C19]'
              }`}
            >
              <Satellite className="h-3.5 w-3.5" /> Satellite
            </button>
            <button
              type="button"
              onClick={() => setBasemap('standard')}
              className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                basemap === 'standard' ? 'bg-white text-[#171C19] shadow-xs' : 'text-[#5C6660] hover:text-[#171C19]'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" /> Street Map
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingVertices(false);
              setDrawingMode((v) => !v);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              drawingMode
                ? 'border-[#D97706] bg-[#FEF3C7] text-[#78350F]'
                : 'border-[#154734] bg-[#154734] text-white hover:bg-[#0E291E]'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            {drawingMode ? 'Finish Plotting' : 'Draw New Plot'}
          </button>

          {drawingMode && draftCoords.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setDraftCoords((prev) => prev.slice(0, -1))}
                className="inline-flex items-center gap-1 rounded-md border border-[#E4E1D6] bg-white px-2.5 py-1.5 text-xs font-medium text-[#171C19] hover:bg-[#FAF9F5] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Undo
              </button>
              <button
                type="button"
                onClick={() => setDraftCoords([])}
                className="inline-flex items-center gap-1 rounded-md border border-[#E4E1D6] bg-white px-2.5 py-1.5 text-xs font-medium text-[#991B1B] hover:bg-[#FDF3F2] cursor-pointer"
              >
                Clear Points
              </button>
            </>
          )}

          {selectedFarm && !drawingMode && (
            <button
              type="button"
              onClick={() => setEditingVertices((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                editingVertices
                  ? 'border-[#154734] bg-[#F3F8F5] text-[#154734]'
                  : 'border-[#E4E1D6] bg-white text-[#171C19] hover:bg-[#FAF9F5]'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              {editingVertices ? 'Done Editing Vertices' : 'Edit Selected Boundary'}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowGeoJsonImport((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E1D6] bg-white px-3 py-1.5 text-xs font-medium text-[#171C19] hover:bg-[#FAF9F5] cursor-pointer"
        >
          <Upload className="h-3.5 w-3.5" /> Import GeoJSON
        </button>
      </div>

      {statusMsg && (
        <div
          className={`rounded-md border px-3.5 py-2 text-xs font-medium ${
            statusMsg.type === 'ok'
              ? 'border-[#C6E3D2] bg-[#F3F8F5] text-[#154734]'
              : 'border-[#F2CECA] bg-[#FDF6F5] text-[#8E1C1C]'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-5">
          <MapWorkspace
            farms={farms}
            selectedFarm={selectedFarm}
            onSelectFarm={onSelectFarm}
            basemap={basemap}
            drawingMode={drawingMode}
            draftCoords={draftCoords}
            onAddDraftPoint={handleAddDraftPoint}
            editingVertices={editingVertices}
            onUpdateEditedGeometry={handleUpdateBoundary}
            heightClass="h-[460px] sm:h-[520px]"
          />

          <Panel title="Registered Field Parcels" subtitle="Select any plot to center viewport and synchronize satellite records">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {farms.map((f) => {
                const active = selectedFarm?.id === f.id;
                return (
                  <div
                    key={f.id}
                    className={`flex items-start justify-between gap-2 rounded-lg border p-3.5 transition-all ${
                      active
                        ? 'border-[#154734] bg-[#F9FBF9] ring-1 ring-[#154734]/20'
                        : 'border-[#E4E1D6] bg-white hover:border-[#C8C4B8]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFarm(f.id);
                        setEditStart(f.analysis_start_date);
                        setEditEnd(f.analysis_end_date);
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-[#171C19]">{f.name}</span>
                        <OriginBadge origin={f.data_origin} />
                      </div>
                      <div className="mt-1 text-[11px] text-[#5C6660]">{f.region}</div>
                      <div className="mt-1.5 font-mono text-[11px] text-[#154734]">
                        {f.area_hectares.toFixed(2)} ha · {f.centroid_lat.toFixed(4)}°N, {f.centroid_lon.toFixed(4)}°E
                      </div>
                    </button>
                    <div className="flex items-center gap-1">
                      {active && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#154734] text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      {!f.is_demo && (
                        <button
                          type="button"
                          onClick={() => handleDeleteFarm(f.id)}
                          disabled={busy}
                          className="rounded p-1 text-[#8E9690] hover:bg-[#FDF3F2] hover:text-[#B91C1C] cursor-pointer"
                          title="Delete farm"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="xl:col-span-4 space-y-5">
          <Panel
            title="Register New Field Plot"
            subtitle={
              drawingMode
                ? `Click vertices on map (${draftCoords.length} pts · ${draftAreaHa.toFixed(2)} ha)`
                : 'Plot vertices on imagery or import GeoJSON polygon'
            }
          >
            <form onSubmit={handleCreateFarm} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Field Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Chellanam South Pokkali Block"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Region / District</label>
                <input
                  type="text"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  placeholder="e.g., Ernakulam, Kerala, India"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Agronomic Farming System</label>
                <select value={newSystem} onChange={(e) => setNewSystem(e.target.value)} className={inputCls}>
                  {FARMING_SYSTEMS.map((fs) => (
                    <option key={fs.value} value={fs.value}>
                      {fs.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#171C19]">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#171C19]">End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              {(showGeoJsonImport || geojsonText) && (
                <div className="space-y-2 rounded-md border border-[#E4E1D6] bg-[#FAF9F5] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#171C19]">GeoJSON Geometry</span>
                    <label className="cursor-pointer text-[11px] font-semibold text-[#154734] hover:underline">
                      Upload .geojson
                      <input type="file" accept=".json,.geojson" onChange={handleUploadGeoJson} className="hidden" />
                    </label>
                  </div>
                  <textarea
                    rows={4}
                    value={geojsonText}
                    onChange={(e) => setGeojsonText(e.target.value)}
                    placeholder='{"type":"Polygon","coordinates":[[[76.28,9.87],...]]}'
                    className="w-full rounded-md border border-[#D8D4C8] bg-white p-2 font-mono text-[11px] focus:border-[#154734] focus:outline-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-[#154734] px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0E291E] disabled:opacity-60 cursor-pointer"
              >
                {busy ? 'Saving Plot...' : 'Save Field Boundary'}
              </button>
            </form>
          </Panel>

          {selectedFarm && (
            <Panel title="Observation Retrieval Window" subtitle="Adjust historical date window for selected plot">
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5C6660]">Window Start</label>
                    <input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5C6660]">Window End</label>
                    <input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAnalysisWindow}
                  disabled={busy}
                  className="w-full rounded-md bg-[#171C19] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2A322E] cursor-pointer"
                >
                  Apply Date Window & Re-sync
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('earth-intelligence')}
                  className="w-full rounded-md border border-[#E4E1D6] bg-white px-3 py-2 text-xs font-semibold text-[#154734] hover:bg-[#FAF9F5] cursor-pointer"
                >
                  Inspect Satellite Layers for Field →
                </button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
