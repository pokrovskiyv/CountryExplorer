const CTASection = () => (
  <section id="cta" className="text-center py-24 px-6 relative">
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,_hsl(217,91%,60%,0.06)_0%,_transparent_70%)] pointer-events-none" />
    <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Ready to explore your market?</h2>
    <p className="text-lg text-muted-foreground mb-8">
      Get early access to Country Explorer and see how your brand stacks up across every region.
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
