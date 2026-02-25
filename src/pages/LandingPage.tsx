import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Screenshot from "@/components/landing/Screenshot";
import StatsBar from "@/components/landing/StatsBar";
import Features from "@/components/landing/Features";
import AgentTeam from "@/components/landing/AgentTeam";
import UseCases from "@/components/landing/UseCases";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const LandingPage = () => (
  <div className="min-h-screen bg-surface-deep text-foreground">
    <Navbar />
    <Hero />
    <Screenshot />
    <StatsBar />
    <Features />
    <AgentTeam />
    <UseCases />
    <CTASection />
    <Footer />
  </div>
);

export default LandingPage;
