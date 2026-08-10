import Navbar from "../../components/layout/Navbar";
import Hero from "../../components/common/Hero";
import Features from "../../components/common/Features";
import HowItWorks from "../../components/common/HowItWorks";
import CTA from "../../components/common/CTA";
import Footer from "../../components/layout/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </>
  );
}