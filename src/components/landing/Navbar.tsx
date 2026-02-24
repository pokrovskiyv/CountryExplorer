import { Link } from "react-router-dom";

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-blue-400">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-50 bg-[hsl(230,30%,6%)]/80 backdrop-blur-xl border-b border-border">
    <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 text-xl font-bold text-foreground">
        <GlobeIcon />
        Getplace
      </Link>
      <div className="flex items-center gap-3">
        <Link to="/explorer" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Try Explorer →
        </Link>
        <a
          href="mailto:hello@getplace.io?subject=Country Explorer — Demo Request"
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          Request a Demo
        </a>
      </div>
    </div>
  </nav>
);

export default Navbar;
