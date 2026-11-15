import { useCallback, useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { EmptyOrErrorState } from './components/ui';
import { ClimateHistoryPage } from './pages/ClimateHistoryPage';
import { ClimateSimulatorPage } from './pages/ClimateSimulatorPage';
import { DecisionReportPage } from './pages/DecisionReportPage';
import { EarthIntelligencePage } from './pages/EarthIntelligencePage';
import { FarmExplorerPage } from './pages/FarmExplorerPage';
import { OverviewPage } from './pages/OverviewPage';
import { RotationLabPage } from './pages/RotationLabPage';
import { SoilProfilePage } from './pages/SoilProfilePage';
import { VulnerabilityPage } from './pages/VulnerabilityPage';
import { api } from './services/api';
import type {
  ClimateTrendsResponse,
  EarthObservationsResponse,
  Farm,
  PageId,
  RotationScenariosResponse,
  RotationWeights,
  SystemStatusResponse,
  VulnerabilityAnalysisResponse,
} from './types/fieldwise';

export function App() {
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [systemStatus, setSystemStatus] = useState<SystemStatusResponse | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);

  const [observations, setObservations] = useState<EarthObservationsResponse | null>(null);
  const [trends, setTrends] = useState<ClimateTrendsResponse | null>(null);
  const [analysis, setAnalysis] = useState<VulnerabilityAnalysisResponse | null>(null);
  const [rotationResult, setRotationResult] = useState<RotationScenariosResponse | null>(null);

  const [loadingFarms, setLoadingFarms] = useState(true);
  const [loadingObs, setLoadingObs] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingRotation, setLoadingRotation] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const selectedFarm = farms.find((f) => f.id === selectedFarmId) || null;

  const loadSystemAndFarms = useCallback(async (preferredId?: string) => {
    setLoadingFarms(true);
    setGlobalError(null);
    try {
      const [statusData, farmsList] = await Promise.all([api.getSystemStatus(), api.listFarms()]);
      setSystemStatus(statusData);
      setFarms(farmsList);
      if (preferredId && farmsList.some((f) => f.id === preferredId)) {
        setSelectedFarmId(preferredId);
      } else if (farmsList.length > 0) {
        const defaultId = farmsList.find((f) => f.id === 'demo-pokkali-kumbalangi')?.id || farmsList[0].id;
        setSelectedFarmId((prev) => (prev && farmsList.some((f) => f.id === prev) ? prev : defaultId));
      } else {
        setSelectedFarmId(null);
      }
    } catch (err) {
      setGlobalError(
        err instanceof Error
          ? `Unable to reach FIELDWISE AI backend (${err.message}). Ensure FastAPI is running on port 8000.`
          : 'Unable to load backend state.',
      );
    } finally {
      setLoadingFarms(false);
    }
  }, []);

  useEffect(() => {
    loadSystemAndFarms();
  }, [loadSystemAndFarms]);

  const syncObservationsForFarm = useCallback(
    async (
      farmId: string,
      opts?: { startDate?: string; endDate?: string; compareYearA?: number; compareYearB?: number; forceRefresh?: boolean },
    ) => {
      setLoadingObs(true);
      setGlobalError(null);
      try {
        const [obsRes, trendsRes, latestAnalysis] = await Promise.all([
          api.getEarthObservations(farmId, opts),
          api.getClimateTrends(farmId, opts),
          api.getLatestAnalysis(farmId),
        ]);
        setObservations(obsRes);
        setTrends(trendsRes);
        setAnalysis(latestAnalysis);
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : 'Failed to synchronize NASA observations.');
      } finally {
        setLoadingObs(false);
      }
    },
    [],
  );

  // Automatically sync observations and rotation scenarios when switching farms
  useEffect(() => {
    if (!selectedFarmId) return;
    setObservations(null);
    setTrends(null);
    setAnalysis(null);
    setRotationResult(null);
    syncObservationsForFarm(selectedFarmId);
  }, [selectedFarmId, syncObservationsForFarm]);

  const handleRunAnalysis = async () => {
    if (!selectedFarmId) return;
    setLoadingAnalysis(true);
    setGlobalError(null);
    try {
      const res = await api.runAnalysis(selectedFarmId);
      setAnalysis(res);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Vulnerability analysis failed.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleEvaluateRotation = async (weights?: RotationWeights) => {
    if (!selectedFarmId) return;
    setLoadingRotation(true);
    setGlobalError(null);
    try {
      const res = await api.evaluateRotationScenarios(selectedFarmId, weights);
      setRotationResult(res);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Rotation evaluation failed.');
    } finally {
      setLoadingRotation(false);
    }
  };

  // Auto-evaluate rotation scenarios when navigating to Rotation Lab if not yet loaded
  useEffect(() => {
    if (activePage === 'rotation-lab' && selectedFarmId && !rotationResult && !loadingRotation) {
      handleEvaluateRotation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePage, selectedFarmId]);

  return (
    <Layout
      activePage={activePage}
      onSelectPage={setActivePage}
      farms={farms}
      selectedFarm={selectedFarm}
      onSelectFarm={(id) => setSelectedFarmId(id)}
      systemStatus={systemStatus}
      loadingObs={loadingObs}
      onRefreshObservations={() => selectedFarmId && syncObservationsForFarm(selectedFarmId, { forceRefresh: true })}
    >
      {globalError && (
        <div className="mb-4">
          <EmptyOrErrorState
            title="Backend / Data Service Notice"
            message={globalError}
            actionLabel="Retry Connection"
            onAction={() => loadSystemAndFarms(selectedFarmId || undefined)}
            isError
          />
        </div>
      )}

      {loadingFarms && farms.length === 0 ? (
        <div className="rounded-lg border border-[#E4E1D6] bg-white p-10 text-center text-xs text-[#5C6660]">
          Loading FIELDWISE AI workspace &amp; demonstration farm profiles...
        </div>
      ) : (
        <>
          {activePage === 'overview' && (
            <OverviewPage
              farm={selectedFarm}
              observations={observations}
              trends={trends}
              analysis={analysis}
              rotationResult={rotationResult}
              loadingObs={loadingObs}
              onRefreshObservations={() => selectedFarmId && syncObservationsForFarm(selectedFarmId, { forceRefresh: true })}
              onRunAnalysis={handleRunAnalysis}
              onNavigate={setActivePage}
            />
          )}
          {activePage === 'explorer' && (
            <FarmExplorerPage
              farms={farms}
              selectedFarm={selectedFarm}
              onSelectFarm={(id) => setSelectedFarmId(id)}
              onFarmsChanged={async (newId) => {
                await loadSystemAndFarms(newId);
              }}
              onNavigate={setActivePage}
            />
          )}
          {activePage === 'earth-intelligence' && (
            <EarthIntelligencePage
              farms={farms}
              selectedFarm={selectedFarm}
              observations={observations}
              loadingObs={loadingObs}
              onRefreshObservations={() => selectedFarmId && syncObservationsForFarm(selectedFarmId, { forceRefresh: true })}
            />
          )}
          {activePage === 'climate-history' && (
            <ClimateHistoryPage
              key={selectedFarm?.id || 'no-farm-climate'}
              farm={selectedFarm}
              trends={trends}
              loading={loadingObs}
              onReloadWithYears={(startDate, endDate, compareYearA, compareYearB) =>
                selectedFarmId && syncObservationsForFarm(selectedFarmId, { startDate, endDate, compareYearA, compareYearB })
              }
            />
          )}
          {activePage === 'soil-profile' && (
            <SoilProfilePage
              key={`${selectedFarm?.id || 'no-farm-soil'}-${selectedFarm?.soil_profile?.updated_at || 'empty'}`}
              farm={selectedFarm}
              onSaved={async () => {
                await loadSystemAndFarms(selectedFarmId || undefined);
                setRotationResult(null);
              }}
            />
          )}
          {activePage === 'vulnerability' && (
            <VulnerabilityPage
              farm={selectedFarm}
              analysis={analysis}
              loading={loadingAnalysis}
              onRunAnalysis={handleRunAnalysis}
            />
          )}
          {activePage === 'rotation-lab' && (
            <RotationLabPage
              farm={selectedFarm}
              rotationResult={rotationResult}
              loading={loadingRotation}
              onEvaluate={handleEvaluateRotation}
            />
          )}
          {activePage === 'climate-simulator' && <ClimateSimulatorPage farm={selectedFarm} />}
          {activePage === 'decision-report' && <DecisionReportPage farm={selectedFarm} />}
        </>
      )}
    </Layout>
  );
}

export default App;
