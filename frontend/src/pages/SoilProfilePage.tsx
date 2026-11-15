import React, { useState } from 'react';
import { CheckCircle2, Info, Plus, Save, Trash2 } from 'lucide-react';
import { EmptyOrErrorState, OriginBadge, Panel } from '../components/ui';
import { api } from '../services/api';
import type { CropHistoryEntry, Farm, SoilProfilePayload } from '../types/fieldwise';

const emptyPayload = (farmingSystem?: string): SoilProfilePayload => ({
  ph: null,
  ec_ds_m: null,
  organic_carbon_pct: null,
  nitrogen_kg_ha: null,
  phosphorus_kg_ha: null,
  potassium_kg_ha: null,
  soil_texture: 'unknown',
  field_soil_moisture_pct: null,
  salinity_class: 'unknown',
  irrigation_availability: 'unknown',
  drainage_class: 'unknown',
  waterlogging_history: 'unknown',
  farmer_constraints: {
    preserve_aquaculture: farmingSystem === 'pokkali_rice_prawn',
    max_water_demand: 'medium',
    prefer_nitrogen_fixer: farmingSystem !== 'pokkali_rice_prawn',
    max_duration_days: 140,
  },
  crop_history: [],
  lab_sample_date: '',
  notes: '',
});

function initialPayload(farm: Farm | null): SoilProfilePayload {
  if (!farm) return emptyPayload();
  const sp = farm.soil_profile;
  if (!sp) return emptyPayload(farm.farming_system);
  return {
    ph: sp.ph,
    ec_ds_m: sp.ec_ds_m,
    organic_carbon_pct: sp.organic_carbon_pct,
    nitrogen_kg_ha: sp.nitrogen_kg_ha,
    phosphorus_kg_ha: sp.phosphorus_kg_ha,
    potassium_kg_ha: sp.potassium_kg_ha,
    soil_texture: sp.soil_texture || 'unknown',
    field_soil_moisture_pct: sp.field_soil_moisture_pct,
    salinity_class: sp.salinity_class || 'unknown',
    irrigation_availability: sp.irrigation_availability || 'unknown',
    drainage_class: sp.drainage_class || 'unknown',
    waterlogging_history: sp.waterlogging_history || 'unknown',
    farmer_constraints: sp.farmer_constraints || {},
    crop_history: sp.crop_history || [],
    lab_sample_date: sp.lab_sample_date || '',
    notes: sp.notes || '',
  };
}

function numOrNull(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function UnitInput({
  label,
  unit,
  step,
  value,
  onChange,
}: {
  label: string;
  unit?: string;
  step: string;
  value: number | null;
  onChange: (val: number | null) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#171C19]">{label}</label>
      <div className="relative mt-1">
        <input
          type="number"
          step={step}
          placeholder="Unknown"
          value={value ?? ''}
          onChange={(e) => onChange(numOrNull(e.target.value))}
          className="w-full rounded-md border border-[#D8D4C8] bg-[#FAF9F5] py-1.5 pl-2.5 pr-12 font-mono text-xs text-[#171C19] placeholder:font-sans placeholder:text-[#8E9690] focus:border-[#154734] focus:bg-white focus:outline-none"
        />
        {unit && (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10.5px] text-[#78827B]">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function SoilProfilePage({
  farm,
  onSaved,
}: {
  farm: Farm | null;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<SoilProfilePayload>(() => initialPayload(farm));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  if (!farm) {
    return <EmptyOrErrorState title="No Farm Selected" message="Select or register a field parcel to log soil chemistry values." />;
  }

  const sp = farm.soil_profile;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.saveSoilProfile(farm.id, form);
      await onSaved();
      setMsg({ type: 'ok', text: 'Saved Soil & Field Management Profile as Field / Lab Input.' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to save soil profile.' });
    } finally {
      setSaving(false);
    }
  };

  const addCropRow = () => {
    const entry: CropHistoryEntry = {
      year: new Date().getFullYear(),
      season: 'Kharif / Virippu (Jun–Oct)',
      crop: '',
      status: 'Harvested',
      origin: 'user_entered',
    };
    setForm((prev) => ({ ...prev, crop_history: [...prev.crop_history, entry] }));
  };

  const selectCls =
    'mt-1 w-full rounded-md border border-[#D8D4C8] bg-[#FAF9F5] px-2.5 py-1.5 text-xs text-[#171C19] focus:border-[#154734] focus:bg-white focus:outline-none';

  return (
    <div className="space-y-5">
      {/* Separation Notice + Completeness Bar */}
      <div className="rounded-lg border border-[#E4E1D6] bg-white p-4 shadow-[0_1px_2px_rgba(23,28,25,0.03)] space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-[#464F49] max-w-4xl">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#1E4E68]" />
            <span>
              <strong className="text-[#171C19]">Laboratory vs Satellite Boundary:</strong> NASA satellites do not measure field soil pH, electrical conductivity (EC), or N-P-K directly. Leave unmeasured inputs blank or &ldquo;Unknown&rdquo;—incomplete parameters are flagged honestly instead of assumed.
            </span>
          </div>
          {sp && <OriginBadge origin={sp.data_origin} />}
        </div>

        {sp && (
          <div className="border-t border-[#EFECE4] pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#171C19]">
                Profile Completeness: <span className="font-mono text-[#154734]">{sp.completeness_pct}%</span>
              </span>
              {sp.missing_parameters.length > 0 && (
                <span className="text-[11px] text-[#78827B]">
                  Pending: {sp.missing_parameters.join(' · ')}
                </span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#ECEAE1]">
              <div
                className="h-full rounded-full bg-[#154734] transition-all"
                style={{ width: `${Math.max(4, sp.completeness_pct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 rounded-md border px-4 py-2.5 text-xs font-medium ${
            msg.type === 'ok'
              ? 'border-[#C6E3D2] bg-[#F3F8F5] text-[#154734]'
              : 'border-[#F2CECA] bg-[#FDF6F5] text-[#8E1C1C]'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{msg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="Laboratory Soil Chemistry" subtitle="Leave blank if unmeasured / not tested in lab">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <UnitInput label="Soil pH (2.0 – 11.0)" step="0.1" value={form.ph} onChange={(ph) => setForm({ ...form, ph })} />
              <UnitInput
                label="Electrical Conductivity (EC)"
                unit="dS/m"
                step="0.05"
                value={form.ec_ds_m}
                onChange={(ec_ds_m) => setForm({ ...form, ec_ds_m })}
              />
              <UnitInput
                label="Organic Carbon"
                unit="%"
                step="0.05"
                value={form.organic_carbon_pct}
                onChange={(organic_carbon_pct) => setForm({ ...form, organic_carbon_pct })}
              />
              <UnitInput
                label="Field Soil Moisture"
                unit="%"
                step="0.5"
                value={form.field_soil_moisture_pct}
                onChange={(field_soil_moisture_pct) => setForm({ ...form, field_soil_moisture_pct })}
              />
              <UnitInput
                label="Available Nitrogen (N)"
                unit="kg/ha"
                step="1"
                value={form.nitrogen_kg_ha}
                onChange={(nitrogen_kg_ha) => setForm({ ...form, nitrogen_kg_ha })}
              />
              <UnitInput
                label="Available Phosphorus (P)"
                unit="kg/ha"
                step="0.5"
                value={form.phosphorus_kg_ha}
                onChange={(phosphorus_kg_ha) => setForm({ ...form, phosphorus_kg_ha })}
              />
              <UnitInput
                label="Available Potassium (K)"
                unit="kg/ha"
                step="1"
                value={form.potassium_kg_ha}
                onChange={(potassium_kg_ha) => setForm({ ...form, potassium_kg_ha })}
              />
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Lab Sample Date</label>
                <input
                  type="text"
                  placeholder="YYYY-MM-DD or Unknown"
                  value={form.lab_sample_date ?? ''}
                  onChange={(e) => setForm({ ...form, lab_sample_date: e.target.value })}
                  className={selectCls}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Physical Soil, Hydrology & Management Rules" subtitle="Enforced directly by deterministic suitability rules">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Soil Texture</label>
                <select
                  value={form.soil_texture || 'unknown'}
                  onChange={(e) => setForm({ ...form, soil_texture: e.target.value })}
                  className={selectCls}
                >
                  <option value="unknown">Unknown / Not Tested</option>
                  <option value="silty_clay">Silty Clay (Coastal Alluvial)</option>
                  <option value="clay_loam">Clay Loam</option>
                  <option value="sandy_clay_loam">Sandy Clay Loam</option>
                  <option value="sandy_loam">Sandy Loam</option>
                  <option value="clay">Heavy Clay</option>
                  <option value="loam">Loam</option>
                  <option value="peaty_acid_sulfate">Peaty / Acid Sulfate (Kari/Pokkali)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Salinity Class</label>
                <select
                  value={form.salinity_class || 'unknown'}
                  onChange={(e) => setForm({ ...form, salinity_class: e.target.value })}
                  className={selectCls}
                >
                  <option value="unknown">Unknown / Not Tested</option>
                  <option value="low">Low (&lt; 2 dS/m)</option>
                  <option value="moderate">Moderate (2–4 dS/m)</option>
                  <option value="high">High (&gt; 4 dS/m)</option>
                  <option value="seasonal_brackish">Seasonal Brackish (Tidal Nov–Apr)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Irrigation Infrastructure</label>
                <select
                  value={form.irrigation_availability || 'unknown'}
                  onChange={(e) => setForm({ ...form, irrigation_availability: e.target.value })}
                  className={selectCls}
                >
                  <option value="unknown">Unknown</option>
                  <option value="tidal_sluice">Tidal Sluice / Bund Control</option>
                  <option value="canal">Canal Irrigation</option>
                  <option value="borewell">Borewell / Open Well</option>
                  <option value="rainfed">Rainfed Only</option>
                  <option value="none">No Dry-Season Irrigation</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Drainage Class</label>
                <select
                  value={form.drainage_class || 'unknown'}
                  onChange={(e) => setForm({ ...form, drainage_class: e.target.value })}
                  className={selectCls}
                >
                  <option value="unknown">Unknown</option>
                  <option value="well_drained">Well Drained</option>
                  <option value="moderately_drained">Moderately Drained</option>
                  <option value="poorly_drained">Poorly Drained</option>
                  <option value="very_poorly_drained">Very Poorly Drained</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Waterlogging History</label>
                <select
                  value={form.waterlogging_history || 'unknown'}
                  onChange={(e) => setForm({ ...form, waterlogging_history: e.target.value })}
                  className={selectCls}
                >
                  <option value="unknown">Unknown</option>
                  <option value="none">None</option>
                  <option value="occasional_monsoon">Occasional Monsoon Ponding</option>
                  <option value="seasonal_prolonged">Seasonal Prolonged Flooding</option>
                  <option value="perennial">Perennial Wetland</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#171C19]">Max Acceptable Crop Duration</label>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min={60}
                    max={365}
                    value={form.farmer_constraints.max_duration_days ?? 140}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        farmer_constraints: {
                          ...form.farmer_constraints,
                          max_duration_days: Number(e.target.value) || 140,
                        },
                      })
                    }
                    className="w-full rounded-md border border-[#D8D4C8] bg-[#FAF9F5] py-1.5 pl-2.5 pr-12 font-mono text-xs text-[#171C19] focus:border-[#154734] focus:bg-white focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10.5px] text-[#78827B]">
                    days
                  </span>
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-[#EFECE4] pt-3">
                <label className="inline-flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(form.farmer_constraints.preserve_aquaculture)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        farmer_constraints: { ...form.farmer_constraints, preserve_aquaculture: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded accent-[#154734]"
                  />
                  <span className="font-medium text-[#171C19]">
                    Preserve seasonal brackish aquaculture (Nov–Apr Pokkali prawn cycle)
                  </span>
                </label>
              </div>
            </div>
          </Panel>
        </div>

        <Panel
          title="Historical Crop & Aquaculture Log"
          subtitle="Seasonal cultivation baseline used by Rotation Lab"
          right={
            <button
              type="button"
              onClick={addCropRow}
              className="inline-flex items-center gap-1 rounded-md border border-[#E4E1D6] bg-white px-2.5 py-1 text-xs font-semibold text-[#154734] hover:bg-[#FAF9F5] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Add Season
            </button>
          }
        >
          {form.crop_history.length === 0 ? (
            <p className="text-xs text-[#5C6660]">No historical seasons logged yet. Click &ldquo;Add Season&rdquo; to record prior cycles.</p>
          ) : (
            <div className="space-y-2.5">
              {form.crop_history.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2.5 rounded-md border border-[#EFECE4] bg-[#FAF9F5] p-3 sm:grid-cols-12 items-center text-xs"
                >
                  <input
                    type="number"
                    value={row.year}
                    onChange={(e) => {
                      const next = [...form.crop_history];
                      next[idx] = { ...row, year: Number(e.target.value) };
                      setForm({ ...form, crop_history: next });
                    }}
                    className="sm:col-span-2 rounded-md border border-[#D8D4C8] bg-white px-2.5 py-1 font-mono"
                    placeholder="Year"
                  />
                  <input
                    type="text"
                    value={row.season}
                    onChange={(e) => {
                      const next = [...form.crop_history];
                      next[idx] = { ...row, season: e.target.value };
                      setForm({ ...form, crop_history: next });
                    }}
                    className="sm:col-span-3 rounded-md border border-[#D8D4C8] bg-white px-2.5 py-1"
                    placeholder="Season"
                  />
                  <input
                    type="text"
                    value={row.crop}
                    onChange={(e) => {
                      const next = [...form.crop_history];
                      next[idx] = { ...row, crop: e.target.value };
                      setForm({ ...form, crop_history: next });
                    }}
                    className="sm:col-span-4 rounded-md border border-[#D8D4C8] bg-white px-2.5 py-1"
                    placeholder="Crop / Aquaculture"
                  />
                  <div className="sm:col-span-2 flex items-center justify-between gap-2">
                    <OriginBadge origin={row.origin} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = form.crop_history.filter((_, i) => i !== idx);
                      setForm({ ...form, crop_history: next });
                    }}
                    className="sm:col-span-1 justify-self-end rounded p-1 text-[#8E9690] hover:bg-[#FDF3F2] hover:text-[#B91C1C] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[#154734] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#0E291E] disabled:opacity-60 cursor-pointer"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving Profile...' : 'Save Soil & Field Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
