const stats = [
  { number: "6,820", desc: "Restaurant locations tracked" },
  { number: "6", desc: "Major QSR brands" },
  { number: "12", desc: "Regions analyzed" },
  { number: "30s", desc: "From question to insight" },
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
