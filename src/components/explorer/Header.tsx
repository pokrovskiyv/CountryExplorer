import { Link } from "react-router-dom";

interface HeaderProps {
  activeView: "map" | "table";
  onViewChange: (view: "map" | "table") => void;
}

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-blue-400">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const Header = ({ activeView, onViewChange }: HeaderProps) => (
  <div className="h-14 bg-[hsl(230,25%,10%)] border-b border-border flex items-center px-5 gap-4 z-50 relative shrink-0">
    <Link to="/" className="flex items-center gap-2 text-lg font-bold text-foreground">
      <GlobeIcon />
      Getplace
    </Link>
    <div className="flex gap-1 ml-8">
      {(["map", "table"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onViewChange(v)}
          className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors capitalize ${
            activeView === v
              ? "bg-blue-600/10 text-blue-400"
              : "text-muted-foreground hover:bg-[hsl(230,25%,13%)] hover:text-slate-300"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
    <select className="ml-auto bg-[hsl(230,25%,13%)] border border-border text-slate-200 px-3 py-1.5 rounded-md text-[13px]">
      <option>🇬🇧 United Kingdom</option>
      <option disabled>🇩🇪 Germany (coming soon)</option>
      <option disabled>🇫🇷 France (coming soon)</option>
    </select>
  </div>
);

export default Header;
