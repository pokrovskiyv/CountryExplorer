const features = [
  { icon: "🗺️", title: "Interactive Choropleth Map", desc: "See brand density across regions at a glance. Color-coded by total locations, per-capita density, or market share. Click any region to drill down." },
  { icon: "📊", title: "Brand Comparison", desc: "Toggle brands on and off. Compare market share across regions. Identify where competitors are strong and where opportunities exist." },
  { icon: "🎯", title: "Region Deep Dive", desc: "Click any region for a detailed breakdown: brand-by-brand analysis, market share charts, population-normalized metrics." },
  { icon: "📍", title: "Location-Level Detail", desc: "Switch to point view to see every individual restaurant location. Filter by attributes like delivery, drive-thru, and more." },
  { icon: "📈", title: "Sortable Data Tables", desc: "Prefer numbers over maps? The table view lets you sort and compare all regions across every metric, with one-click export." },
  { icon: "🔔", title: "Change Alerts (Coming Soon)", desc: "Get notified when competitors open or close locations in your key regions. Never miss a market move again." },
];

const Features = () => (
  <section id="features" className="max-w-[1100px] mx-auto py-24 px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Everything you need to understand the market</h2>
      <p className="text-lg text-muted-foreground max-w-[600px] mx-auto">
        From high-level overview to individual location details, Country Explorer gives you the full picture.
      </p>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {features.map((f) => (
        <div key={f.title} className="bg-surface-0 border border-border rounded-xl p-7 transition-colors hover:border-blue-600/25">
          <div className="w-11 h-11 bg-blue-600/10 rounded-xl flex items-center justify-center text-[22px] mb-4">
            {f.icon}
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
        </div>
      ))}
    </div>
  </section>
);

export default Features;
