const Hero = () => (
  <section className="pt-40 pb-24 px-6 text-center relative overflow-hidden">
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,_hsl(217,91%,60%,0.08)_0%,_transparent_70%)] pointer-events-none" />
    <span className="inline-block bg-blue-600/10 border border-blue-600/25 text-blue-400 px-4 py-1.5 rounded-full text-[13px] font-medium mb-6">
      131 months of real footprint data
    </span>
    <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold leading-[1.1] max-w-[800px] mx-auto mb-5 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
      The competitive map your restaurant chain has been missing
    </h1>
    <p className="text-lg sm:text-xl text-muted-foreground max-w-[600px] mx-auto mb-10 leading-relaxed">
      6,820+ locations across every UK region. 10 years of real footprint history. An interactive map that shows where competitors are winning — and where you should be next. Four intelligent agents surface the patterns automatically.
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
        className="bg-surface-1 hover:bg-surface-2 text-muted-foreground px-8 py-3.5 rounded-xl text-base font-medium border border-border transition-all"
      >
        See the Platform
      </a>
    </div>
  </section>
);

export default Hero;
