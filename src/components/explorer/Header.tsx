import { Link } from "react-router-dom";
import { Crosshair, FileDown } from "lucide-react";
import { exportViewAsPDF } from "@/lib/export-pdf";

export type ViewType = "map" | "table" | "radar";

interface HeaderProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  contentRef?: React.RefObject<HTMLDivElement>;
}

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-blue-400">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const VIEW_LABELS: Record<ViewType, string> = {
  map: "Map",
  table: "Table",
  radar: "Radar",
};

const Header = ({ activeView, onViewChange, contentRef }: HeaderProps) => (
  <div className="h-14 bg-[hsl(230,25%,10%)] border-b border-border flex items-center px-5 gap-4 z-50 relative shrink-0">
    <Link to="/" className="flex items-center gap-2 text-lg font-bold text-foreground">
      <GlobeIcon />
      Getplace
    </Link>
    <div className="flex gap-1 ml-8">
      {(["map", "table", "radar"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onViewChange(v)}
          className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors flex items-center gap-1.5 ${
            activeView === v
              ? "bg-blue-600/10 text-blue-400"
              : "text-muted-foreground hover:bg-[hsl(230,25%,13%)] hover:text-slate-300"
          }`}
        >
          {v === "radar" && <Crosshair className="w-3.5 h-3.5" />}
          {VIEW_LABELS[v]}
          {v === "radar" && (
            <span className="text-[9px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded-full font-bold uppercase leading-none ml-0.5">
              New
            </span>
          )}
        </button>
      ))}
    </div>
    {contentRef?.current && (
      <button
        onClick={() => exportViewAsPDF(contentRef.current!)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[hsl(230,25%,13%)] border border-border text-muted-foreground hover:text-slate-300 hover:border-slate-600 transition-colors ml-auto"
      >
        <FileDown className="w-3.5 h-3.5" />
        Export PDF
      </button>
    )}
    <select className={`${contentRef?.current ? "" : "ml-auto "}bg-[hsl(230,25%,13%)] border border-border text-slate-200 px-3 py-1.5 rounded-md text-[13px]`}>
      <option>🇬🇧 United Kingdom</option>
      <option disabled>🇩🇪 Germany (coming soon)</option>
      <option disabled>🇫🇷 France (coming soon)</option>
    </select>
  </div>
);

export default Header;
