import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Header from "@/components/explorer/Header";
import type { ViewType } from "@/components/explorer/Header";
import Sidebar from "@/components/explorer/Sidebar";
import MapView from "@/components/explorer/MapView";
import RegionPanel from "@/components/explorer/RegionPanel";
import TableView from "@/components/explorer/TableView";
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
import { useAlerts } from "@/hooks/useAlerts";

type CountryCode = "uk" | "de";
type Metric = "total" | "density" | "share";
type Display = "choropleth" | "points" | "both" | "heatmap";

const TOPO_URLS: Record<CountryCode, string> = {
  uk: "/uk-topo.json",
  de: "/de-topo.json",
};

const VALID_VIEWS = new Set<ViewType>(["map", "table", "radar"]);

function readViewFromHash(): ViewType {
  const raw = window.location.hash.replace("#", "") as ViewType;
  return VALID_VIEWS.has(raw) ? raw : "map";
}

const Explorer = () => {
  const [activeCountry, setActiveCountry] = useState<CountryCode>("uk");
  const [activeView, setActiveView] = useState<ViewType>(readViewFromHash);
  const countryConfig = COUNTRY_CONFIGS[activeCountry];
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(
    () => new Set(Object.keys(countryConfig.brands))
  );
  const [metric, setMetric] = useState<Metric>("total");
  const [display, setDisplay] = useState<Display>("choropleth");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [topoData, setTopoData] = useState<any>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);

  const handleApplyBrandGroup = useCallback((brands: readonly string[]) => {
    setSelectedBrands(new Set(brands));
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
  }, []);

  const handleToggleBrand = useCallback((brand: string, checked: boolean) => {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (checked) next.add(brand);
      else next.delete(brand);
      return next;
    });
  }, []);

  const handleRegionSelect = useCallback((name: string) => {
    setSelectedRegion(name);
    setActiveView("map");
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedRegion(null);
  }, []);

  const handleRadarRegionSelect = useCallback((name: string) => {
    radar.setSelectedRegion(name);
  }, [radar.setSelectedRegion]);

  const handleRadarClosePanel = useCallback(() => {
    radar.setSelectedRegion(null);
  }, [radar.setSelectedRegion]);

  return (
    <CountryProvider config={countryConfig}>
      <div className="h-screen flex flex-col bg-[hsl(230,30%,6%)] text-slate-200 overflow-hidden">
        <Header
          activeView={activeView}
          onViewChange={setActiveView}
          contentRef={contentRef}
          activeCountry={activeCountry}
          onCountryChange={handleCountryChange}
          alertUnreadCount={alerts.unreadCount}
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
                onMetricChange={setMetric}
                display={display}
                onDisplayChange={setDisplay}
                brandGroups={brandGroups}
                onApplyBrandGroup={handleApplyBrandGroup}
                onCreateBrandGroup={createBrandGroup}
                onDeleteBrandGroup={deleteBrandGroup}
              />
              {activeView === "map" ? (
                <>
                  <MapView
                    selectedBrands={selectedBrands}
                    metric={metric}
                    display={display}
                    selectedRegion={selectedRegion}
                    onRegionSelect={handleRegionSelect}
                    topoData={topoData}
                    visibleIndices={timeline.visibleIndices}
                  />
                  <RegionPanel region={selectedRegion} onClose={handleClosePanel} selectedBrands={selectedBrands} />
                </>
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
