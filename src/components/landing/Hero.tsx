const Hero = () => (
  <section className="pt-40 pb-24 px-6 text-center relative overflow-hidden">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,_hsl(217,91%,60%,0.08)_0%,_transparent_70%)] pointer-events-none" />
    <span className="inline-block bg-blue-600/10 border border-blue-600/25 text-blue-400 px-4 py-1.5 rounded-full text-[13px] font-medium mb-6">
      New Feature
    </span>
    <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold leading-[1.1] max-w-[800px] mx-auto mb-5 bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
      See the entire restaurant landscape at a glance
    </h1>
    <p className="text-lg sm:text-xl text-muted-foreground max-w-[600px] mx-auto mb-10 leading-relaxed">
      Country Explorer gives restaurant chains instant visibility into competitor presence across every region. No spreadsheets. No guesswork. Just data.
    </p>
    <div className="flex gap-4 justify-center flex-wrap">
      <a
        href="mailto:hello@getplace.io?subject=Country Explorer — Early Access Request"
        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all hover:-translate-y-0.5"
      >
        Get Early Access
      </a>
      <a
        href="#features"
        className="bg-[hsl(230,25%,13%)] hover:bg-[hsl(230,25%,16%)] text-slate-300 px-8 py-3.5 rounded-xl text-base font-medium border border-border transition-all"
      >
        See How It Works
      </a>
    </div>
  </section>
);

export default Hero;
