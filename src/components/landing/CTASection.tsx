const CTASection = () => (
  <section id="cta" className="text-center py-24 px-6 relative">
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,_hsl(217,91%,60%,0.06)_0%,_transparent_70%)] pointer-events-none" />
    <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">See where the opportunity is before your competitors do</h2>
    <p className="text-lg text-muted-foreground mb-8">
      Early access includes the full platform — interactive map, 10-year timeline, automated intelligence, and expansion scoring for every UK region.
    </p>
    <a
      href="mailto:hello@getplace.io?subject=Country Explorer — Early Access Request"
      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all hover:-translate-y-0.5"
    >
      Request Early Access
    </a>
  </section>
);

export default CTASection;
