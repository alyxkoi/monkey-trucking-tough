import { ArrowRight, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";

import gravelDrivewayImg from "@/assets/projects/gravel-driveway.webp";
import stockPondImg from "@/assets/projects/stock-pond-excavation.webp";
import crushedConcreteDeliveryImg from "@/assets/projects/crushed-concrete-delivery.webp";
import ranchRoadImg from "@/assets/projects/ranch-road-repair.webp";
import landClearingImg from "@/assets/projects/land-clearing.webp";
import masonSandDeliveryImg from "@/assets/projects/mason-sand-delivery.webp";
import aggregateHaulingImg from "@/assets/services/aggregate-hauling.webp";
import drivewayImg from "@/assets/services/gravel-driveway-installation.webp";
import pondImg from "@/assets/services/pond-construction.webp";
import dirtWorkImg from "@/assets/services/dirt-work.webp";
import crushedConcreteImg from "@/assets/materials/crushed-concrete.webp";
import decomposedGraniteImg from "@/assets/materials/decomposed-granite.webp";
import flexBaseImg from "@/assets/materials/flex-base.webp";
import masonSandImg from "@/assets/materials/mason-sand.webp";
import millingsImg from "@/assets/materials/millings.webp";
import nativeGravelImg from "@/assets/materials/1in-native-gravel.webp";

const PHONE_HREF = "tel:+12146778466";
const HERO_VIDEO = "https://ssuciilipipwlakpwhim.supabase.co/storage/v1/object/public/videos/hero.mp4";

const services = [
  { title: "Materials & Delivery", line: "Aggregate delivered where you need it.", image: aggregateHaulingImg, to: "/materials" },
  { title: "Driveways & Roads", line: "New builds, repairs and regrading.", image: drivewayImg, to: "/services" },
  { title: "Ponds", line: "Pond excavation, grading and drainage work.", image: pondImg, to: "/services" },
  { title: "Dirt Work", line: "Grading, site prep and light clearing.", image: dirtWorkImg, to: "/services" },
];

const materials = [
  { name: 'Flexbase First Class 1" or 3"', use: "Driveways and base", image: flexBaseImg },
  { name: "Commercial Crushed Concrete Clean", use: "Driveways and compactable base", image: crushedConcreteImg },
  { name: "Mason Sand", use: "Masonry and leveling", image: masonSandImg },
  { name: 'Millings Asphalt 1/2" Minus', use: "Driveways and parking areas", image: millingsImg },
  { name: 'Native Gravel 3/8"-1"', use: "Driveways and drainage", image: nativeGravelImg },
  { name: "Decomposed Granite", use: "Paths, patios and ground cover", image: decomposedGraniteImg },
];

const projects = [
  { title: "New Gravel Driveway", category: "Driveways", image: gravelDrivewayImg },
  { title: "Stock Pond Excavation", category: "Ponds", image: stockPondImg },
  { title: "Crushed Concrete Delivery", category: "Delivery", image: crushedConcreteDeliveryImg },
  { title: "Ranch Road Repair", category: "Dirt Work", image: ranchRoadImg },
  { title: "Light Clearing & Grading", category: "Dirt Work", image: landClearingImg },
  { title: "Mason Sand Delivery", category: "Delivery", image: masonSandDeliveryImg },
];

const areaServed = ["Kaufman", "Forney", "Terrell", "Crandall", "Kemp", "Mabank", "Kaufman County", "Dallas-Fort Worth"];

const homeJsonLd = {
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
  areaServed: areaServed.map((name) => ({ "@type": "Place", name })),
  makesOffer: [
    "Material delivery",
    "Driveway and private road work",
    "Pond work",
    "Dirt work and grading",
    "Aggregate hauling",
    "Light land clearing",
  ].map((name) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name } })),
};

const Index = () => (
  <>
    <Seo
      title="Gravel Delivery, Driveways & Dirt Work | Kaufman TX"
      description="Materials, gravel delivery, driveway work, ponds and dirt work in Kaufman, Texas and surrounding DFW areas. Call Monkey Trucking or request a quote."
      path="/"
      jsonLd={homeJsonLd}
    />

    <section className="relative flex min-h-[680px] items-end overflow-hidden bg-nearblack pb-16 pt-32 sm:min-h-[720px] sm:pb-20 lg:min-h-[760px] lg:items-center lg:py-32">
      <video autoPlay muted loop playsInline preload="metadata" src={HERO_VIDEO} poster={aggregateHaulingImg} className="absolute inset-0 h-full w-full object-cover" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-r from-nearblack via-nearblack/75 to-nearblack/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-nearblack via-transparent to-nearblack/35" />
      <div className="relative z-10 mx-auto w-full max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-[780px]">
          <p className="mb-4 font-label text-base font-semibold text-white/80">Kaufman, Texas</p>
          <h1 className="max-w-[760px] font-heading text-[clamp(54px,8vw,112px)] uppercase leading-[0.88] tracking-[0.01em] text-white">
            <span className="text-primary">Gravel, delivery</span> &amp; dirt work
          </h1>
          <p className="mt-6 max-w-[620px] text-lg leading-relaxed text-white/85 sm:text-xl">Materials, driveways, ponds and dirt work across Kaufman and surrounding areas.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={PHONE_HREF} className="public-button public-button-primary"><Phone className="h-5 w-5" />Call 214-677-8466</a>
            <Link to="/contact" className="public-button public-button-light">Get a Quote<ArrowRight className="h-5 w-5" /></Link>
          </div>
        </div>
      </div>
    </section>

    <section className="bg-[#ecebea] py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <h2 className="font-heading text-[clamp(40px,5vw,68px)] uppercase leading-none text-foreground">What do you need?</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {services.map((service) => (
            <Link key={service.title} to={service.to} className="group overflow-hidden rounded-lg bg-industrial shadow-sm">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={service.image} alt={service.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.025]" />
              </div>
              <div className="flex min-h-[138px] items-start justify-between gap-3 p-4 sm:min-h-[126px] sm:p-5">
                <div>
                  <h3 className="font-heading text-xl uppercase leading-none text-white sm:text-2xl">{service.title}</h3>
                  <p className="mt-2 text-[15px] leading-snug text-white/70 sm:text-base">{service.line}</p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-white py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-heading text-[clamp(40px,5vw,68px)] uppercase leading-none text-foreground">Popular materials</h2>
            <p className="mt-3 text-lg text-muted-foreground">Sold by the yard. Full loads available.</p>
          </div>
          <Link to="/materials" className="public-text-link">View all materials <ArrowRight className="h-5 w-5" /></Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {materials.map((material) => (
            <article key={material.name} className="overflow-hidden rounded-lg border border-black/10 bg-[#f5f4f2]">
              <div className="aspect-[4/3] bg-[#ebe9e5] p-2">
                <img src={material.image} alt={`${material.name} aggregate sample`} loading="lazy" decoding="async" className="h-full w-full object-contain" />
              </div>
              <div className="p-4">
                <h3 className="font-label text-[17px] font-bold leading-tight text-foreground">{material.name}</h3>
                <p className="mt-2 text-[15px] leading-snug text-muted-foreground">{material.use}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-nearblack py-14 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
          <h2 className="font-heading text-[clamp(40px,5vw,68px)] uppercase leading-none text-white">Recent work</h2>
          <Link to="/projects" className="public-text-link text-white hover:text-primary">View all projects <ArrowRight className="h-5 w-5" /></Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {projects.map((project) => (
            <figure key={project.title} className="group overflow-hidden rounded-lg bg-asphalt">
              <div className="aspect-[4/3] overflow-hidden">
                <img src={project.image} alt={project.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.025]" />
              </div>
              <figcaption className="min-h-[104px] p-4">
                <span className="font-label text-sm font-semibold text-primary">{project.category}</span>
                <h3 className="mt-1 font-heading text-xl uppercase leading-none text-white sm:text-2xl">{project.title}</h3>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-[#232326] text-white">
      <div className="mx-auto grid max-w-[1380px] grid-cols-1 divide-y divide-white/10 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8 lg:px-12">
        {[
          ["Based in Kaufman", "Serving Kaufman County and surrounding DFW areas."],
          ["Local materials & delivery", "Material supply, hauling and job-site delivery."],
          ["Upfront quotes", "Call us or send a quote request with what you need."],
        ].map(([title, line]) => (
          <div key={title} className="py-7 sm:px-6 sm:py-9 first:sm:pl-0 last:sm:pr-0">
            <h2 className="font-heading text-2xl uppercase text-primary">{title}</h2>
            <p className="mt-2 max-w-sm text-base leading-relaxed text-white/70">{line}</p>
          </div>
        ))}
      </div>
    </section>

    <section className="bg-primary py-16 sm:py-20">
      <div className="mx-auto max-w-[1000px] px-5 text-center sm:px-8">
        <h2 className="font-heading text-[clamp(44px,7vw,82px)] uppercase leading-[0.92] text-white">Need material or work done?</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">Call us or send us what you need.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={PHONE_HREF} className="public-button bg-industrial text-white hover:bg-[#242428]"><Phone className="h-5 w-5" />Call 214-677-8466</a>
          <Link to="/contact" className="public-button border-2 border-white bg-white text-primary hover:bg-transparent hover:text-white">Get a Quote</Link>
        </div>
      </div>
    </section>
  </>
);

export default Index;
