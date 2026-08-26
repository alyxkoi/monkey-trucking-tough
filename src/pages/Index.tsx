import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Phone,
  MessageSquare,
  ChevronDown,
  ArrowRight,
  Truck,
  Clock,
  DollarSign,
  Users,
  Construction,
  Droplets,
  Shovel,
  Mountain,
  Quote,
} from "lucide-react";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import ContactActionSheet from "@/components/ContactActionSheet";
import Reveal from "@/components/home/Reveal";
import CountUp from "@/components/home/CountUp";
import BeforeAfter from "@/components/home/BeforeAfter";

import gravelDrivewayImg from "@/assets/projects/gravel-driveway.webp";
import stockPondImg from "@/assets/projects/stock-pond-excavation.webp";
import crushedConcreteImg from "@/assets/projects/crushed-concrete-delivery.webp";
import ranchRoadImg from "@/assets/projects/ranch-road-repair.webp";
import drivewayRegradingImg from "@/assets/projects/driveway-regrading.webp";
import pondDrainageImg from "@/assets/projects/pond-drainage-fix.webp";
import landClearingImg from "@/assets/projects/land-clearing.webp";
import masonSandDeliveryImg from "@/assets/projects/mason-sand-delivery.webp";
import gravelParkingImg from "@/assets/projects/gravel-parking-pad.webp";

import aggregateHaulingImg from "@/assets/services/aggregate-hauling.webp";
import gravelDrivewayServiceImg from "@/assets/services/gravel-driveway-installation.webp";
import pondServiceImg from "@/assets/services/pond-construction.webp";
import dirtWorkServiceImg from "@/assets/services/dirt-work.webp";
import materialDeliveryServiceImg from "@/assets/services/material-delivery.webp";

import millingsImg from "@/assets/materials/millings.webp";
import nativeGravelImg from "@/assets/materials/1in-native-gravel.webp";
import decomposedGraniteImg from "@/assets/materials/decomposed-granite.webp";
import masonSandImg from "@/assets/materials/mason-sand.webp";
import flexBaseImg from "@/assets/materials/flex-base.webp";
import matCrushedConcreteImg from "@/assets/materials/crushed-concrete.webp";

const PHONE = "+12146778466";
const HERO_VIDEO = "https://ssuciilipipwlakpwhim.supabase.co/storage/v1/object/public/videos/hero.mp4";

const stats = [
  { value: 12, suffix: "+", label: "Years in Business" },
  { value: 150, suffix: "+", label: "Jobs Completed" },
  { value: 0, suffix: "", label: "Located in Kaufman, Texas", custom: "LOCAL" },
];


const benefits = [
  { icon: DollarSign, title: "Lower prices, no middleman", body: "We own the plant. You skip the markup." },
  { icon: Truck, title: "Faster trucks, local crew", body: "Based in Kaufman, on the road across DFW." },
  { icon: Clock, title: "Honest upfront quotes", body: "No surprise fees. What we quote is what you pay." },
  { icon: Users, title: "Family-owned. We answer.", body: "We pick up the phone — and we follow through." },
];

const services = [
  { title: "GRAVEL DELIVERY & AGGREGATE HAULING", blurb: "Gravel, crushed concrete, flex base, and sand — straight from our own plant to your job site.", image: aggregateHaulingImg, feature: true, icon: Truck },
  { title: "DRIVEWAY & ROAD CONSTRUCTION", blurb: "Durable gravel driveways and private roads built to last.", image: gravelDrivewayServiceImg, icon: Construction },
  { title: "POND CONSTRUCTION", blurb: "Stock, irrigation, and decorative ponds dug and graded right.", image: pondServiceImg, icon: Droplets },
  { title: "DIRT WORK & LAND CLEARING", blurb: "Site prep, grading, and clearing — done to spec.", image: dirtWorkServiceImg, icon: Shovel },
  { title: "MATERIAL DELIVERY", blurb: "Same-week drops, on time, right where you need them.", image: materialDeliveryServiceImg, icon: Mountain },
];

const marqueeItems = [
  "GRAVEL", "CRUSHED CONCRETE", "FLEX BASE", "MASON SAND",
  "DECOMPOSED GRANITE", "TOP SOIL", "DIRT WORK", "PONDS",
  "DRIVEWAYS", "LAND CLEARING",
];

const projects = [
  { title: "New Gravel Driveway", category: "Driveways", image: gravelDrivewayImg },
  { title: "Stock Pond Excavation", category: "Ponds", image: stockPondImg },
  { title: "Crushed Concrete Delivery", category: "Delivery", image: crushedConcreteImg },
  { title: "Ranch Road Repair", category: "Dirt Work", image: ranchRoadImg },
  { title: "Land Clearing & Grading", category: "Dirt Work", image: landClearingImg },
  { title: "Mason Sand Delivery", category: "Delivery", image: masonSandDeliveryImg },
];

const STORAGE_BASE = "https://ssuciilipipwlakpwhim.supabase.co/storage/v1/object/public/images/materialzoomins";
const materials = [
  { name: "MILLINGS", blurb: "Recycled asphalt, affordable & durable.", image: millingsImg, tint: "#ededed", zoom: `${STORAGE_BASE}/millings.jpeg` },
  { name: "NATIVE GRAVELS", blurb: "Clean, durable, multiple sizes.", image: nativeGravelImg, tint: "#eeedeb", zoom: `${STORAGE_BASE}/native%20gravel.jpeg` },
  { name: "DECOMPOSED GRANITE", blurb: "Finely crushed for walkways & patios.", image: decomposedGraniteImg, tint: "#f2ece4", zoom: `${STORAGE_BASE}/decomposed%20granite.jpeg` },
  { name: "MASON SAND", blurb: "Fine sand for masonry & leveling.", image: masonSandImg, tint: "#f5efe5", zoom: `${STORAGE_BASE}/mason%20sand.jpeg` },
  { name: "FLEX BASE", blurb: "Compactable limestone base.", image: flexBaseImg, tint: "#f0ebe3", zoom: `${STORAGE_BASE}/flex%20base.jpeg` },
  { name: "CRUSHED CONCRETE", blurb: "Recycled — driveways & base layers.", image: matCrushedConcreteImg, tint: "#efefef", zoom: `${STORAGE_BASE}/crushed%20concrete.jpeg` },
];

const cities = [
  "Kaufman", "Forney", "Terrell", "Crandall", "Kemp", "Mabank", "Scurry",
  "Sachse", "Royse City", "Canton", "Wills Point", "Seagoville", "Mesquite",
  "Dallas", "Oak Cliff", "Rockwall",
];

const testimonials = [
  { quote: "Monkey Trucking delivered gravel for our driveway fast and at a fair price. Will definitely use again.", name: "James R.", project: "Gravel Driveway — Kaufman" },
  { quote: "Honest pricing and reliable service. They showed up on time and got the job done right.", name: "Sarah M.", project: "Material Delivery — Terrell" },
  { quote: "Great work on our pond. Professional crew that knows what they're doing.", name: "Mike T.", project: "Pond Construction — Forney" },
];

const steps = [
  { n: "01", title: "Call or Text", body: "Tell us what you need." },
  { n: "02", title: "Get a Free Quote", body: "Honest, upfront pricing." },
  { n: "03", title: "We Haul or Build It", body: "Fast, on schedule." },
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="eyebrow mb-5">{children}</span>
);

const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

const heroJsonLd = {
  "@context": "https://schema.org",
  "@type": "HomeAndConstructionBusiness",
  name: "Monkey Trucking LLC",
  url: "https://www.monkeytrucking.llc",
  telephone: "+1-214-677-8466",
  address: {
    "@type": "PostalAddress",
    streetAddress: "7653 S FM 148",
    addressLocality: "Kaufman",
    addressRegion: "TX",
    postalCode: "75142",
    addressCountry: "US",
  },
  areaServed: cities.map((c) => ({ "@type": "City", name: c })),
  makesOffer: services.map((s) => ({
    "@type": "Offer",
    itemOffered: { "@type": "Service", name: s.title },
  })),
};

const Index = () => {
  // Stagger hero entrance
  const [hero, setHero] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setHero(true), 80);
    return () => clearTimeout(t);
  }, []);

  const heroItem = (delay: number) => ({
    opacity: hero ? 1 : 0,
    transform: hero ? "translateY(0)" : "translateY(24px)",
    transition: `opacity 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 700ms cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
  });

  return (
    <>
      <Seo
        title="Gravel Delivery & Hauling Kaufman TX | Monkey Trucking — DFW"
        description="Local, family-owned gravel delivery, driveway installation, pond construction, and dirt work in Kaufman, TX. Aggregate hauling across all of DFW. Call or text for a fast quote."
        path="/"
        jsonLd={heroJsonLd}
      />

      {/* ============ HERO ============ */}
      <section
        className="relative w-full min-h-[100svh] md:min-h-[100dvh] flex items-center bg-nearblack overflow-hidden grain"
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          src={HERO_VIDEO}
          poster={gravelDrivewayImg}
          className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
          aria-hidden
        />
        {/* Directional scrim */}
        <div className="absolute inset-0 bg-gradient-to-r from-nearblack via-nearblack/80 to-nearblack/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-nearblack via-nearblack/40 to-transparent" />

        <div className="relative z-10 flex w-full justify-center px-5 py-20 text-center sm:px-8 md:px-12 md:py-24">
          <div className="w-full max-w-[720px] red-glow">
            <div style={heroItem(0)} className="mb-6 text-center flex justify-center">
              <span className="eyebrow">Kaufman, TX • Serving all of DFW</span>
            </div>
            <h1
              style={{
                ...heroItem(120),
                fontSize: "clamp(48px, 8.4vw, 124px)",
                lineHeight: 0.92,
                letterSpacing: "0.01em",
              }}
              className="font-heading text-white uppercase mb-8 text-center"
            >
              <span className="text-primary">gravel, hauling</span> &amp; dirt work across DFW
            </h1>
            <div style={heroItem(360)} className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4 mb-10">
              <ContactActionSheet>
                {({ onClick }) => (
                  <Button
                    onClick={onClick}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading tracking-wider px-7 h-14 min-h-[52px] text-lg shadow-[0_18px_40px_rgba(255,59,59,0.35)] hover:-translate-y-0.5 transition-transform w-full sm:w-auto"
                  >
                    <Phone className="mr-2 h-5 w-5" />
                    CALL OR TEXT FOR A FREE QUOTE
                  </Button>
                )}
              </ContactActionSheet>
              <button
                onClick={() => scrollToId("proof")}
                className="inline-flex items-center justify-center font-heading tracking-wider px-7 h-14 min-h-[52px] text-lg border border-white/30 text-white hover:bg-white/10 transition-colors rounded-md"
              >
                SEE OUR WORK
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </div>
            <div style={heroItem(480)} className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-white/70 text-[13px] sm:text-sm font-medium">
              <span className="whitespace-nowrap">12+ Years</span>
              <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
              <span className="whitespace-nowrap">150+ Jobs Done</span>
              <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
              <span className="whitespace-nowrap">Family-Owned</span>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <button
          onClick={() => scrollToId("stats")}
          aria-label="Scroll down"
          className="hidden md:flex absolute bottom-8 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-white/60 hover:text-white animate-bounce-soft z-10"
        >
          <span className="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
          <ChevronDown className="h-5 w-5" />
        </button>
      </section>

      {/* ============ STATS — on hero black, no container ============ */}
      <div id="stats" className="relative bg-nearblack">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8 py-20 md:py-28">
          <Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 md:gap-12 text-center">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="font-heading text-white text-5xl md:text-7xl leading-none mb-3">
                    {s.custom ? <span>{s.custom}</span> : <CountUp end={s.value} suffix={s.suffix} />}
                  </div>
                  <div className="text-xs md:text-sm tracking-[0.22em] uppercase text-white/60 font-medium">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>




      {/* ============ WHY US (dark) ============ */}
      <section id="why-us" className="relative bg-nearblack grain overflow-hidden py-24 md:py-32">
        
        <div className="max-w-[1240px] mx-auto px-5 md:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal>
              <div className="relative aspect-[4/5] md:aspect-[5/6] overflow-hidden rounded-xl hairline">
                <img src={aggregateHaulingImg} alt="Monkey Trucking dump truck loaded with aggregate" loading="lazy" decoding="async" width="1200" height="1500" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-nearblack/70 via-transparent to-transparent" />
                <span className="absolute bottom-5 left-5 bg-primary text-primary-foreground text-xs font-semibold tracking-[0.2em] px-3 py-1.5 rounded">FROM OUR PLANT</span>
              </div>
            </Reveal>
            <div>
              <Reveal>
                <SectionLabel>Why Monkey Trucking</SectionLabel>
                <h2 className="font-heading uppercase text-white red-glow" style={{ fontSize: "clamp(36px, 4.8vw, 64px)", lineHeight: 1, letterSpacing: "0.01em" }}>
                  We run our own plant — so you skip the middleman.
                </h2>
                <p className="text-white/75 text-lg leading-relaxed mt-5 mb-8 max-w-xl">
                  Because we produce our own materials and we&apos;re family-owned, you get lower prices, faster trucks, and a crew that actually picks up the phone. No layers, no runaround.
                </p>
              </Reveal>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-8">
                {benefits.map((b, i) => (
                  <Reveal key={b.title} delay={i * 80}>
                    <div className="dark-card p-5">
                      <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center mb-3">
                        <b.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-heading text-white text-lg tracking-wide mb-1">{b.title}</h3>
                      <p className="text-white/65 text-sm leading-relaxed">{b.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal>
                <ContactActionSheet>
                  {({ onClick }) => (
                    <Button onClick={onClick} className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading tracking-wider px-7 h-13 min-h-[48px] text-base shadow-[0_18px_40px_rgba(255,59,59,0.3)] hover:-translate-y-0.5 transition-transform">
                      <Phone className="mr-2 h-5 w-5" />
                      GET MY FREE QUOTE
                    </Button>
                  )}
                </ContactActionSheet>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      

      {/* ============ SERVICES BENTO ============ */}
      <section className="relative bg-nearblack py-24 md:py-32 grain">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <SectionLabel>What we do</SectionLabel>
              <h2 className="font-heading uppercase text-white" style={{ fontSize: "clamp(36px, 5vw, 68px)", lineHeight: 1 }}>
                Real work. Real equipment. <span className="text-primary">Real results.</span>
              </h2>
            </div>
          </Reveal>

          {(() => {
            const flagship = services.find((s) => s.feature) ?? services[0];
            const rest = services.filter((s) => s !== flagship);
            const Card = ({ s, big = false, i = 0 }: { s: typeof services[number]; big?: boolean; i?: number }) => (
              <Reveal delay={i * 70} className="h-full">
                <Link
                  to="/services"
                  className="group relative block w-full h-full overflow-hidden rounded-xl hairline shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
                >
                  <img
                    src={s.image}
                    alt={s.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-nearblack via-nearblack/60 to-nearblack/10" />
                  <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="w-10 h-10 rounded-md bg-white/10 backdrop-blur-sm flex items-center justify-center">
                        <s.icon className="h-5 w-5 text-white" />
                      </div>
                      <ArrowRight className="h-5 w-5 text-white/70 group-hover:translate-x-1 group-hover:text-primary transition-all" />
                    </div>
                    <h3 className={`font-heading text-white uppercase tracking-wide leading-tight ${big ? "text-3xl md:text-5xl" : "text-xl md:text-2xl"}`}>
                      {s.title}
                    </h3>
                    <p className={`text-white/75 mt-2 max-w-xl ${big ? "text-base md:text-lg" : "text-sm"}`}>
                      {s.blurb}
                    </p>
                  </div>
                  <div className="absolute bottom-0 left-0 h-[3px] bg-primary w-0 group-hover:w-full transition-all duration-500" />
                </Link>
              </Reveal>
            );
            return (
              <div className="space-y-4 md:space-y-5">
                <div className="h-[340px] md:h-[460px]">
                  <Card s={flagship} big i={0} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                  {rest.map((s, i) => (
                    <div key={s.title} className="h-[280px] md:h-[320px]">
                      <Card s={s} i={i + 1} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="text-center mt-12">
            <Link to="/services">
              <Button variant="outline" className="border border-white/30 bg-transparent text-white hover:bg-white hover:text-nearblack font-heading tracking-wider px-7 h-12 min-h-[48px]">
                VIEW ALL SERVICES
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <div className="bg-nearblack">
        <div className="bg-asphalt border-y border-white/[0.06] overflow-hidden marquee">
          <div className="marquee-track py-5 animate-marquee">
            {[0, 1].map((rep) => (
              <div key={rep} className="flex items-center gap-10 px-5 shrink-0" aria-hidden={rep === 1}>
                {marqueeItems.map((item) => (
                  <div key={`${rep}-${item}`} className="flex items-center gap-10 shrink-0">
                    <span className="font-heading tracking-[0.18em] text-white/85 text-xl md:text-2xl whitespace-nowrap">{item}</span>
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ PROOF (before/after + grid) ============ */}
      <section id="proof" className="relative bg-nearblack py-24 md:py-32 grain overflow-hidden">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <SectionLabel>Our work</SectionLabel>
              <h2 className="font-heading uppercase text-white red-glow" style={{ fontSize: "clamp(36px, 5vw, 68px)", lineHeight: 1 }}>
                Built tough. <span className="text-primary">Built right.</span>
              </h2>
            </div>
          </Reveal>

          <Reveal>
            <div className="max-w-4xl mx-auto mb-16">
              <BeforeAfter
                before={drivewayRegradingImg}
                after={gravelDrivewayImg}
                beforeAlt="Driveway before regrading — washed out and uneven"
                afterAlt="Finished gravel driveway after Monkey Trucking installation in Kaufman TX"
              />
              <p className="text-center text-white/55 text-sm mt-4">Drag the handle — washed-out driveway → finished gravel install.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {projects.map((p, i) => (
              <Reveal key={p.title} delay={i * 60}>
                <Link to="/projects" className="group relative block h-72 rounded-xl overflow-hidden hairline shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                  <img src={p.image} alt={`${p.title} — Monkey Trucking project`} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-nearblack/95 via-nearblack/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.22em] text-primary mb-2">{p.category}</span>
                    <h3 className="font-heading text-white text-xl tracking-wide">{p.title}</h3>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/projects">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading tracking-wider px-7 h-12 min-h-[48px]">
                VIEW ALL PROJECTS
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ MATERIALS (concrete) ============ */}
      <section className="relative bg-concrete py-24 md:py-32">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <SectionLabel>Materials</SectionLabel>
              <h2 className="font-heading uppercase text-nearblack" style={{ fontSize: "clamp(34px, 4.6vw, 60px)", lineHeight: 1 }}>
                Aggregate straight from <span className="text-primary">our plant</span>.
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {materials.map((m, i) => (
              <Reveal key={m.name} delay={i * 60}>
                <Link to="/materials" className="group block bg-white rounded-xl overflow-hidden border border-black/10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_18px_40px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all">
                  <div className="relative h-44 sm:h-52 overflow-hidden material-card" style={{ backgroundColor: m.tint }}>
                    <span className="absolute top-3 left-3 z-10 bg-primary text-primary-foreground text-[10px] font-semibold tracking-[0.18em] px-2.5 py-1 rounded">FROM OUR PLANT</span>
                    {m.image && (
                      <img src={m.image} alt={`${m.name.toLowerCase()} aggregate sample`} loading="lazy" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[90%] max-h-[80%] object-contain object-bottom transition-transform duration-700 group-hover:scale-105" />
                    )}
                  </div>
                  <div className="p-4 border-t border-black/5 relative">
                    <div className="absolute left-0 top-4 w-1 h-6 bg-primary rounded-r" />
                    <h3 className="font-heading text-nearblack text-base md:text-lg tracking-wide pl-3 group-hover:text-primary transition-colors">{m.name}</h3>
                    <p className="text-nearblack/60 text-sm pl-3 mt-1 leading-snug">{m.blurb}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to="/materials">
              <Button variant="outline" className="border-2 border-nearblack text-nearblack hover:bg-nearblack hover:text-white font-heading tracking-wider px-7 h-12 min-h-[48px]">
                VIEW ALL MATERIALS
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============ SERVICE AREA (dark) ============ */}
      <section className="relative bg-nearblack py-24 md:py-32 grain overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-[680px] h-[680px] rounded-full opacity-[0.08]"
            style={{
              background:
                "radial-gradient(circle at center, transparent 38%, rgba(255,59,59,0.6) 39%, transparent 40%, transparent 58%, rgba(255,255,255,0.5) 59%, transparent 60%, transparent 78%, rgba(255,255,255,0.3) 79%, transparent 80%)",
            }}
          />
        </div>
        <div className="max-w-[1240px] mx-auto px-5 md:px-8 relative">
          <Reveal>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <SectionLabel>Where we work</SectionLabel>
              <h2 className="font-heading uppercase text-white" style={{ fontSize: "clamp(34px, 4.6vw, 60px)", lineHeight: 1 }}>
                Based in Kaufman. <span className="text-primary">Working all over DFW.</span>
              </h2>
              <p className="text-white/70 text-lg mt-5 leading-relaxed">
                Kaufman County is home base, but we deliver materials and run equipment across the entire Dallas–Fort Worth metroplex.
              </p>
            </div>
          </Reveal>
          <Reveal>
            <div className="flex flex-wrap justify-center gap-2.5 md:gap-3 max-w-3xl mx-auto">
              {cities.map((c) => (
                <a
                  key={c}
                  href={`tel:${PHONE}`}
                  className="inline-flex items-center px-4 h-10 rounded-full border border-white/15 bg-white/5 text-white/80 text-sm font-medium hover:bg-primary hover:border-primary hover:text-primary-foreground transition-colors"
                >
                  {c}
                </a>
              ))}
              <span className="inline-flex items-center px-4 h-10 rounded-full bg-primary text-primary-foreground text-sm font-semibold tracking-wide">
                + all of DFW
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="relative bg-asphalt py-24 md:py-32">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <SectionLabel>What customers say</SectionLabel>
              <h2 className="font-heading uppercase text-white" style={{ fontSize: "clamp(34px, 4.6vw, 56px)", lineHeight: 1 }}>
                Trusted across Kaufman County.
              </h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 90}>
                <div className="dark-card p-7 h-full hover:-translate-y-1 transition-transform">
                  <Quote className="h-9 w-9 text-primary mb-4" />
                  <p className="text-white/85 text-base leading-relaxed mb-5">"{t.quote}"</p>
                  <div>
                    <p className="font-heading text-white text-lg tracking-wide">{t.name}</p>
                    <p className="text-white/55 text-sm">{t.project}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="relative bg-concrete py-24 md:py-32">
        <div className="max-w-[1240px] mx-auto px-5 md:px-8">
          <Reveal>
            <div className="text-center mb-14">
              <SectionLabel>How it works</SectionLabel>
              <h2 className="font-heading uppercase text-nearblack" style={{ fontSize: "clamp(34px, 4.6vw, 60px)", lineHeight: 1 }}>
                Three steps. <span className="text-primary">No runaround.</span>
              </h2>
            </div>
          </Reveal>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto">
            <div className="hidden md:block absolute top-8 left-[14%] right-[14%] h-px bg-nearblack/15" aria-hidden />
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="relative bg-white rounded-xl p-7 border border-black/10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] text-center">
                  <div className="relative inline-flex w-16 h-16 rounded-full bg-primary text-primary-foreground items-center justify-center font-heading text-2xl tracking-wider mx-auto mb-5 shadow-[0_10px_24px_rgba(255,59,59,0.35)]">
                    {s.n}
                  </div>
                  <h3 className="font-heading text-nearblack text-2xl tracking-wide mb-2">{s.title}</h3>
                  <p className="text-nearblack/65 text-base">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="text-center mt-10">
              <ContactActionSheet>
                {({ onClick }) => (
                  <Button onClick={onClick} className="bg-primary text-primary-foreground hover:bg-primary/90 font-heading tracking-wider px-7 h-13 min-h-[48px] text-base shadow-[0_18px_40px_rgba(255,59,59,0.3)] hover:-translate-y-0.5 transition-transform">
                    <Phone className="mr-2 h-5 w-5" />
                    START WITH A FREE QUOTE
                  </Button>
                )}
              </ContactActionSheet>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative bg-primary py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.5), transparent 50%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.4), transparent 55%)",
        }} />
        <div className="relative max-w-[1240px] mx-auto px-5 md:px-8 text-center">
          <Reveal>
            <h2 className="font-heading text-white uppercase" style={{ fontSize: "clamp(38px, 5.4vw, 72px)", lineHeight: 1 }}>
              Need gravel, hauling, <br className="hidden md:block" /> or dirt work?
            </h2>
            <p className="text-white/90 text-lg md:text-xl mt-5 max-w-2xl mx-auto">
              Call or text Monkey Trucking for a free quote — no obligation. Local, family-owned, and ready to roll.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mt-9">
              <a href={`tel:${PHONE}`} className="inline-flex items-center justify-center gap-2 h-14 min-h-[52px] px-8 rounded-md bg-nearblack text-white font-heading tracking-wider text-lg hover:bg-asphalt hover:-translate-y-0.5 transition-all shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
                <Phone className="h-5 w-5" />
                CALL NOW
              </a>
              <a href={`sms:${PHONE}`} className="inline-flex items-center justify-center gap-2 h-14 min-h-[52px] px-8 rounded-md border-2 border-white text-white font-heading tracking-wider text-lg hover:bg-white hover:text-primary transition-colors">
                <MessageSquare className="h-5 w-5" />
                TEXT US
              </a>
            </div>
            <p className="text-white/80 text-sm mt-6">
              Prefer email?{" "}
              <Link to="/contact" className="underline underline-offset-4 font-semibold">
                Send us a message
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* Spacer so mobile call bar doesn't cover footer content */}
      <div className="md:hidden h-20" aria-hidden />
    </>
  );
};

export default Index;
