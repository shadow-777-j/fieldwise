import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Compass,
  FileText,
  Layers,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Satellite,
  Sliders,
  Sprout,
  X,
} from 'lucide-react';
import type { Farm, PageId, SystemStatusResponse } from '../types/fieldwise';
import { cn } from '../utils/cn';
import { OriginBadge } from './ui';

const NAV_GROUPS: {
  heading: string;
  items: { id: PageId; label: string; Icon: React.ComponentType<{ className?: string }> }[];
}[] = [
  {
    heading: 'Field Workspace',
    items: [
      { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
      { id: 'explorer', label: 'Farm Explorer', Icon: Compass },
      { id: 'soil-profile', label: 'Soil & Management', Icon: Sprout },
    ],
  },
  {
    heading: 'Earth & Climate',
    items: [
      { id: 'earth-intelligence', label: 'Satellite Layers', Icon: Satellite },
      { id: 'climate-history', label: 'Climate & Vegetation', Icon: BarChart3 },
    ],
  },
  {
    heading: 'Agronomic Decisions',
    items: [
      { id: 'vulnerability', label: 'Vulnerability Index', Icon: AlertTriangle },
      { id: 'rotation-lab', label: 'Rotation Lab', Icon: Layers },
      { id: 'climate-simulator', label: 'Climate Simulator', Icon: Sliders },
      { id: 'decision-report', label: 'Decision Report', Icon: FileText },
    ],
  },
];

const PAGE_LABELS: Record<PageId, string> = {
  overview: 'Field Overview',
  explorer: 'Farm Explorer & Boundaries',
  'earth-intelligence': 'Satellite Layers & Provenance',
  'climate-history': 'Climate & Vegetation History',
  'soil-profile': 'Soil Chemistry & Management Profile',
  vulnerability: 'Vulnerability Assessment',
  'rotation-lab': 'Crop Rotation Lab',
  'climate-simulator': 'Climate Sensitivity Simulator',
  'decision-report': 'Decision Report Export',
};

function FieldwiseBrandMark() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7 shrink-0" aria-hidden="true">
      <rect width="28" height="28" rx="6" fill="#154734" />
      <path
        d="M5 18.5C9 15 13.5 14 23 15.5M5 22C10 19 15 18.2 23 19.5"
        stroke="#A7DFC1"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M6.5 12.5C9.5 9.2 14.5 8 21.5 9.8"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="2 2.5"
      />
      <circle cx="18.5" cy="8.5" r="2.1" fill="#FBBF24" />
    </svg>
  );
}

export function Layout({
  activePage,
  onSelectPage,
  farms,
  selectedFarm,
  onSelectFarm,
  systemStatus,
  loadingObs,
  onRefreshObservations,
  children,
}: {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  farms: Farm[];
  selectedFarm: Farm | null;
  onSelectFarm: (farmId: string) => void;
  systemStatus: SystemStatusResponse | null;
  loadingObs: boolean;
  onRefreshObservations: () => void;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const geeConnected = systemStatus?.data_services.google_earth_engine.authenticated ?? false;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#EFEDE6] text-[#171C19]">
      {/* Brand Lockup */}
      <div className="flex items-center justify-between border-b border-[#E2DFD4] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <FieldwiseBrandMark />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold tracking-[-0.02em] text-[#171C19]">FIELDWISE</span>
              <span className="rounded bg-[#E2DFD4] px-1 py-0.5 font-mono text-[9px] font-semibold text-[#154734]">
                AI
              </span>
            </div>
            <div className="text-[10.5px] font-medium text-[#5C6660]">NASA Agricultural Observatory</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-md p-1 text-[#5C6660] hover:bg-[#E4E1D6] lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Active Field Selector */}
      <div className="border-b border-[#E2DFD4] px-3.5 py-3">
        <label htmlFor="farm-switcher" className="block text-[10.5px] font-semibold text-[#5C6660]">
          Active Field Plot
        </label>
        <select
          id="farm-switcher"
          value={selectedFarm?.id || ''}
          onChange={(e) => onSelectFarm(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-[#D8D4C8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#171C19] shadow-[0_1px_1px_rgba(23,28,25,0.03)] focus:border-[#154734] focus:outline-none"
        >
          {farms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.area_hectares.toFixed(2)} ha)
            </option>
          ))}
        </select>
      </div>

      {/* Grouped Editorial Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading}>
            <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#78827B]">
              {group.heading}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ id, label, Icon }) => {
                const active = activePage === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onSelectPage(id);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      'group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-all cursor-pointer',
                      active
                        ? 'bg-white font-semibold text-[#154734] shadow-[0_1px_2px_rgba(23,28,25,0.06)] ring-1 ring-[#E0DDD2]'
                        : 'font-medium text-[#464F49] hover:bg-[#E7E4DA]/75 hover:text-[#171C19]',
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#154734]" />
                    )}
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        active ? 'text-[#154734]' : 'text-[#6D7770] group-hover:text-[#171C19]',
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Telemetry Feed Status Footer */}
      <div className="border-t border-[#E2DFD4] bg-[#EAE7DF]/70 px-3.5 py-3 text-[11px] space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[#464F49]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1D7A4C]" />
            NASA POWER / MODIS
          </span>
          <span className="font-mono text-[10.5px] font-semibold text-[#154734]">LIVE</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[#464F49]">
            <span className={cn('h-1.5 w-1.5 rounded-full', geeConnected ? 'bg-[#1D7A4C]' : 'bg-[#B7791F]')} />
            Landsat 30m (GEE)
          </span>
          <span className={cn('font-mono text-[10.5px] font-medium', geeConnected ? 'text-[#154734]' : 'text-[#8C5B12]')}>
            {geeConnected ? 'AUTH OK' : 'AUTH REQ'}
          </span>
        </div>
        <div className="pt-1 font-mono text-[10px] text-[#78827B] truncate" title={systemStatus?.database_backend}>
          {systemStatus?.database_backend || 'Local SQLite persistence'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F6F5F0]">
      {/* Desktop Left Rail */}
      <aside className="hidden w-60 shrink-0 border-r border-[#E2DFD4] lg:block">{sidebarContent}</aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-68 max-w-[85vw] shrink-0 border-r border-[#E2DFD4] shadow-xl">{sidebarContent}</div>
          <div className="flex-1 bg-[#171C19]/35 backdrop-blur-[1px]" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Main Observatory Viewport */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Architectural Utility Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E1D6] bg-white/90 px-4 py-3 sm:px-5 backdrop-blur-xs">
          <div className="flex min-w-0 max-w-full flex-1 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="shrink-0 rounded-md border border-[#E4E1D6] p-1.5 text-[#171C19] hover:bg-[#F6F5F0] lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            {selectedFarm ? (
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#5C6660]">
                    {PAGE_LABELS[activePage]}
                  </span>
                  <span className="text-[#C8C4B8] hidden sm:inline">/</span>
                  <h1 className="max-w-full truncate text-sm font-bold tracking-[-0.015em] text-[#171C19]">
                    {selectedFarm.name}
                  </h1>
                  <OriginBadge origin={selectedFarm.data_origin} />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-[#5C6660]">
                  <span className="truncate">{selectedFarm.region}</span>
                  <span className="text-[#D2CFC4]">·</span>
                  <span>
                    {selectedFarm.centroid_lat.toFixed(4)}°N, {selectedFarm.centroid_lon.toFixed(4)}°E
                  </span>
                  <span className="text-[#D2CFC4]">·</span>
                  <span className="tabular-nums font-medium text-[#154734]">
                    {selectedFarm.area_hectares.toFixed(2)} ha
                  </span>
                  <span className="hidden sm:inline text-[#D2CFC4]">·</span>
                  <span className="hidden sm:inline">
                    {selectedFarm.analysis_start_date} – {selectedFarm.analysis_end_date}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm font-semibold text-[#171C19]">{PAGE_LABELS[activePage]}</div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {selectedFarm && (
              <button
                type="button"
                onClick={onRefreshObservations}
                disabled={loadingObs}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#154734] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#0E291E] disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loadingObs && 'animate-spin')} />
                <span>{loadingObs ? 'Syncing NASA Telemetry...' : 'Sync NASA Data'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Content Workspace */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1380px] min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
