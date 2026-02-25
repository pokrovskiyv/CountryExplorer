const stats = [
  { number: "6,820+", desc: "Restaurant locations tracked" },
  { number: "131", desc: "Months of real footprint history" },
  { number: "12", desc: "UK regions with city drill-down" },
  { number: "17", desc: "Insight types surfaced automatically" },
];

const StatsBar = () => (
  <div className="max-w-[1100px] mx-auto my-16 px-6 grid grid-cols-2 lg:grid-cols-4 gap-5">
    {stats.map((s) => (
      <div key={s.desc} className="text-center p-6 bg-surface-0 border border-border rounded-xl">
        <div className="text-4xl font-extrabold text-blue-400">{s.number}</div>
        <div className="text-sm text-muted-foreground mt-1">{s.desc}</div>
      </div>
    ))}
  </div>
);

export default StatsBar;
