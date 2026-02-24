import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Screenshot from "@/components/landing/Screenshot";
import StatsBar from "@/components/landing/StatsBar";
import Features from "@/components/landing/Features";
import UseCases from "@/components/landing/UseCases";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const LandingPage = () => (
  <div className="min-h-screen bg-[hsl(230,30%,6%)] text-slate-200">
    <Navbar />
    <Hero />
    <Screenshot />
    <StatsBar />
    <Features />
    <UseCases />
    <CTASection />
    <Footer />
  </div>
);

export default LandingPage;
