import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { LayerId, TrafficLayerOptions } from "@/hooks/map-layers/types";
import Header from "@/components/explorer/Header";
import type { ViewType } from "@/components/explorer/Header";
import Sidebar from "@/components/explorer/Sidebar";
import MapView from "@/components/explorer/MapView";
import RegionPanel from "@/components/explorer/RegionPanel";
import ContextPanel from "@/components/explorer/ContextPanel";
import type { ContextTarget } from "@/components/explorer/ContextPanel";
import TableView from "@/components/explorer/TableView";
import OpportunitiesView from "@/components/explorer/OpportunitiesView";
import SmartMapView from "@/components/explorer/SmartMapView";
import RadarSidebar from "@/components/radar/RadarSidebar";
import RadarMapView from "@/components/radar/RadarMapView";
import RadarPanel from "@/components/radar/RadarPanel";
import { useExpansionRadar } from "@/hooks/useExpansionRadar";
import { useBrandGroups } from "@/hooks/useBrandGroups";
import { useTimeline } from "@/hooks/useTimeline";
import TimelineSlider from "@/components/explorer/TimelineSlider";
import AlertsPanel from "@/components/explorer/AlertsPanel";
import { CountryProvider } from "@/contexts/CountryContext";
import { COUNTRY_CONFIGS } from "@/data/country-configs";
import { useCountryData } from "@/hooks/useCountryData";
import { useAlerts } from "@/hooks/useAlerts";
import { useAgents } from "@/hooks/useAgents";
import { useExplorerPersistence, createDebouncedPositionSaver, clearSavedMapPosition } from "@/hooks/useExplorerPersistence";

type CountryCode = "uk";
type Metric = "total" | "density" | "share";
type Display = "choropleth" | "points" | "both" | "heatmap";

const TOPO_URLS: Record<CountryCode, string> = {
  uk: "/uk-topo.json",
};

const VALID_VIEWS = new Set<ViewType>(["smart-map", "table"]);

function readViewFromHash(): ViewType {
  const raw = window.location.hash.replace("#", "") as ViewType;
  return VALID_VIEWS.has(raw) ? raw : "smart-map";
}

const Explorer = () => {
  const [activeCountry, setActiveCountry] = useState<CountryCode>("uk");
  const [activeView, setActiveView] = useState<ViewType>(readViewFromHash);
  const { config: countryConfig, isLoading: isCountryLoading } = useCountryData(activeCountry);
  const {
    metric, setMetric,
    display, setDisplay,
    activeLayers, setActiveLayers,
    trafficOptions, setTrafficOptions,
    selectedBrands, setSelectedBrands,
    savedMapPosition,
  } = useExplorerPersistence({ allBrandKeys: Object.keys(countryConfig.brands) });
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [contextTarget, setContextTarget] = useState<ContextTarget>(null);
  const [mapStyle, setMapStyle] = useState<"default" | "satellite">("default");
  const [topoData, setTopoData] = useState<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleMapPositionChange = useMemo(() => createDebouncedPositionSaver(500), []);

  useEffect(() => {
    window.location.hash = activeView;
  }, [activeView]);

  useEffect(() => {
    const onHashChange = () => setActiveView(readViewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const scoringData = useMemo(() => ({
    brands: countryConfig.brands,
    regionCounts: countryConfig.regionCounts,
    population: countryConfig.population,
  }), [countryConfig]);

  const radar = useExpansionRadar(activeView === "radar", scoringData);
  const { groups: brandGroups, createGroup: createBrandGroup, deleteGroup: deleteBrandGroup } = useBrandGroups(countryConfig.brands);
  const timeline = useTimeline();
  const alerts = useAlerts(timeline.currentMonth, countryConfig);
  const agents = useAgents(timeline.currentMonth, countryConfig);
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const [pendingFlyToRegion, setPendingFlyToRegion] = useState<string | null>(null);

  const handleApplyBrandGroup = useCallback((brands: readonly string[]) => {
    setSelectedBrands(new Set(brands));
  }, []);

  const handleInsightNavigate = useCallback((insight: { region: string }) => {
    setActiveView("smart-map");
    setAlertsPanelOpen(false);
    setPendingFlyToRegion(insight.region);
  }, []);

  // Load TopoJSON per country
  useEffect(() => {
    setTopoData(null);
    fetch(TOPO_URLS[activeCountry])
      .then((r) => r.json())
      .then(setTopoData)
      .catch((err) => {
        // Fallback: try prototype.html for UK
        if (activeCountry === "uk") {
          fetch("/prototype.html")
            .then((r) => r.text())
            .then((html) => {
              const match = html.match(/const TOPO_DATA = (\{.*?\});[\r\n]/s);
              if (match) setTopoData(JSON.parse(match[1]));
            })
            .catch(() => {});
        }
      });
  }, [activeCountry]);

  // Reset state when country changes
  const handleCountryChange = useCallback((code: CountryCode) => {
    const config = COUNTRY_CONFIGS[code];
    setActiveCountry(code);
    setSelectedBrands(new Set(Object.keys(config.brands)));
    setSelectedRegion(null);
    clearSavedMapPosition();
  }, []);

  const handleToggleBrand = useCallback((brand: string, checked: boolean) => {
    setSelectedBrands((prev) => {
      // In market share mode, only one brand can be selected (radio behavior)
      if (metric === "share") return new Set([brand])
      const next = new Set(prev);
      if (checked) next.add(brand);
      else next.delete(brand);
      return next;
    });
  }, [metric]);

  const handleRegionSelect = useCallback((name: string) => {
    setSelectedRegion(name);
    setContextTarget(null);
  }, []);

  const handleToggleLayer = useCallback((id: LayerId) => {
    setActiveLayers((prev) => {
      const next = new Set(prev)
      // Demographic layers are mutually exclusive
      if (id === "demographicIncome" && !prev.has(id)) { next.delete("demographicImd") }
      if (id === "demographicImd" && !prev.has(id)) { next.delete("demographicIncome") }

      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedRegion(null);
  }, []);

  const handleContextTarget = useCallback((target: ContextTarget) => {
    setContextTarget(target);
    setSelectedRegion(null); // close RegionPanel when ContextPanel opens
  }, []);

  const handleCloseContext = useCallback(() => {
    setContextTarget(null);
  }, []);

  const handleRadarRegionSelect = useCallback((name: string) => {
    radar.setSelectedRegion(name);
  }, [radar.setSelectedRegion]);

  const handleRadarClosePanel = useCallback(() => {
    radar.setSelectedRegion(null);
  }, [radar.setSelectedRegion]);

  return (
    <CountryProvider config={countryConfig}>
      <div className="h-screen flex flex-col bg-surface-deep text-foreground overflow-hidden">
        <Header
          activeView={activeView}
          onViewChange={setActiveView}
          contentRef={contentRef}
          activeCountry={activeCountry}
          onCountryChange={handleCountryChange}
          alertUnreadCount={alerts.unreadCount + agents.unreadCount}
          onAlertClick={() => setAlertsPanelOpen(true)}
        />
        <AlertsPanel
          open={alertsPanelOpen}
          onClose={() => setAlertsPanelOpen(false)}
          rules={alerts.rules}
          events={alerts.events}
          onAddRule={alerts.addRule}
          onRemoveRule={alerts.removeRule}
          onMarkAllRead={alerts.markAllRead}
          insights={agents.insights}
          onMarkAllInsightsRead={agents.markAllRead}
          onInsightNavigate={handleInsightNavigate}
          selectedBrands={selectedBrands}
          allBrandsCount={Object.keys(countryConfig.brands).length}
        />
        {activeView !== "radar" && (
          <TimelineSlider
            currentMonth={timeline.currentMonth}
            currentDate={timeline.currentDate}
            isPlaying={timeline.isPlaying}
            onMonthChange={timeline.setCurrentMonth}
            onTogglePlay={timeline.togglePlay}
          />
        )}
        <div ref={contentRef} className="flex flex-1 overflow-hidden">
          {activeView === "radar" ? (
            <>
              <RadarSidebar
                targetBrand={radar.targetBrand}
                onBrandChange={radar.setTargetBrand}
                weights={radar.weights}
                onWeightsChange={radar.setWeights}
                onResetWeights={radar.resetWeights}
                scores={radar.scores}
                topOpportunities={radar.topOpportunities}
                selectedRegion={radar.selectedRegion}
                onSelectRegion={handleRadarRegionSelect}
              />
              <RadarMapView
                topoData={topoData}
                scores={radar.scores}
                selectedRegion={radar.selectedRegion}
                onRegionSelect={handleRadarRegionSelect}
                targetBrand={radar.targetBrand}
              />
              <RadarPanel
                targetBrand={radar.targetBrand}
                selectedScore={radar.selectedRegion ? radar.getRegionScore(radar.selectedRegion) : undefined}
                topOpportunities={radar.topOpportunities}
                onSelectRegion={handleRadarRegionSelect}
                onClose={handleRadarClosePanel}
                weights={radar.weights}
                allScores={radar.scores}
              />
            </>
          ) : (
            <>
              <Sidebar
                selectedBrands={selectedBrands}
                onToggleBrand={handleToggleBrand}
                metric={metric}
                onMetricChange={(m) => {
                  if (m === "share" && selectedBrands.size > 1) {
                    setSelectedBrands(new Set([[...selectedBrands][0]]))
                  }
                  setMetric(m)
                }}
                display={display}
                onDisplayChange={setDisplay}
                brandGroups={brandGroups}
                onApplyBrandGroup={handleApplyBrandGroup}
                onCreateBrandGroup={createBrandGroup}
                onDeleteBrandGroup={deleteBrandGroup}
                visibleIndices={timeline.visibleIndices}
                activeLayers={activeLayers}
                onToggleLayer={handleToggleLayer}
                trafficOptions={trafficOptions}
                onTrafficOptionsChange={setTrafficOptions}
                mapStyle={mapStyle}
                onMapStyleChange={setMapStyle}
              />
              {activeView === "smart-map" ? (
                <SmartMapView
                  selectedBrands={selectedBrands}
                  metric={metric}
                  display={display}
                  selectedRegion={selectedRegion}
                  onRegionSelect={handleRegionSelect}
                  topoData={topoData}
                  visibleIndices={timeline.visibleIndices}
                  activeLayers={activeLayers}
                  trafficOptions={trafficOptions}
                  initialCenter={savedMapPosition?.center}
                  initialZoom={savedMapPosition?.zoom}
                  onMapPositionChange={handleMapPositionChange}
                  onContextTarget={handleContextTarget}
                  mapStyle={mapStyle}
                  pendingFlyToRegion={pendingFlyToRegion}
                  onFlyToComplete={() => setPendingFlyToRegion(null)}
                />
              ) : activeView === "map" ? (
                <>
                  <MapView
                    selectedBrands={selectedBrands}
                    metric={metric}
                    display={display}
                    selectedRegion={selectedRegion}
                    onRegionSelect={handleRegionSelect}
                    topoData={topoData}
                    visibleIndices={timeline.visibleIndices}
                    activeLayers={activeLayers}
                    trafficOptions={trafficOptions}
                    initialCenter={savedMapPosition?.center}
                    initialZoom={savedMapPosition?.zoom}
                    onMapPositionChange={handleMapPositionChange}
                    onContextTarget={handleContextTarget}
                    mapStyle={mapStyle}
                  />
                  {contextTarget ? (
                    <ContextPanel target={contextTarget} onClose={handleCloseContext} selectedBrands={selectedBrands} />
                  ) : (
                    <RegionPanel region={selectedRegion} onClose={handleClosePanel} selectedBrands={selectedBrands} />
                  )}
                </>
              ) : activeView === "opportunities" ? (
                <div className="flex-1 overflow-auto">
                  <OpportunitiesView selectedBrands={selectedBrands} />
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <TableView onRegionSelect={handleRegionSelect} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </CountryProvider>
  );
};

export default Explorer;
