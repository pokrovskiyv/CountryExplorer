import { useState, useEffect, useCallback } from "react";
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
import { BRANDS } from "@/data/uk-data";

type Metric = "total" | "density" | "share";
type Display = "choropleth" | "points" | "both";

const VALID_VIEWS = new Set<ViewType>(["map", "table", "radar"]);

function readViewFromHash(): ViewType {
  const raw = window.location.hash.replace("#", "") as ViewType;
  return VALID_VIEWS.has(raw) ? raw : "map";
}

const Explorer = () => {
  const [activeView, setActiveView] = useState<ViewType>(readViewFromHash);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set(Object.keys(BRANDS)));
  const [metric, setMetric] = useState<Metric>("total");
  const [display, setDisplay] = useState<Display>("choropleth");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [topoData, setTopoData] = useState<any>(null);

  useEffect(() => {
    window.location.hash = activeView;
  }, [activeView]);

  useEffect(() => {
    const onHashChange = () => setActiveView(readViewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const radar = useExpansionRadar(activeView === "radar");

  // Load TopoJSON from prototype HTML
  useEffect(() => {
    fetch("/prototype.html")
      .then((r) => r.text())
      .then((html) => {
        const match = html.match(/const TOPO_DATA = (\{.*?\});[\r\n]/s);
        if (match) {
          try {
            setTopoData(JSON.parse(match[1]));
          } catch (e) {
            console.error("Failed to parse TopoJSON", e);
          }
        }
      })
      .catch(console.error);
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
    <div className="h-screen flex flex-col bg-[hsl(230,30%,6%)] text-slate-200 overflow-hidden">
      <Header activeView={activeView} onViewChange={setActiveView} />
      <div className="flex flex-1 overflow-hidden">
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
                />
                <RegionPanel region={selectedRegion} onClose={handleClosePanel} />
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
  );
};

export default Explorer;
