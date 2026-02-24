import { useState, useEffect, useCallback } from "react";
import Header from "@/components/explorer/Header";
import Sidebar from "@/components/explorer/Sidebar";
import MapView from "@/components/explorer/MapView";
import RegionPanel from "@/components/explorer/RegionPanel";
import TableView from "@/components/explorer/TableView";
import { BRANDS } from "@/data/uk-data";

type Metric = "total" | "density" | "share";
type Display = "choropleth" | "points" | "both";

const Explorer = () => {
  const [activeView, setActiveView] = useState<"map" | "table">("map");
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set(Object.keys(BRANDS)));
  const [metric, setMetric] = useState<Metric>("total");
  const [display, setDisplay] = useState<Display>("choropleth");
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [topoData, setTopoData] = useState<any>(null);

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

  return (
    <div className="h-screen flex flex-col bg-[hsl(230,30%,6%)] text-slate-200 overflow-hidden">
      <Header activeView={activeView} onViewChange={setActiveView} />
      <div className="flex flex-1 overflow-hidden">
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
      </div>
    </div>
  );
};

export default Explorer;
