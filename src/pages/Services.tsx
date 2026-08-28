import { Phone } from "lucide-react";
import Seo from "@/components/Seo";
import CTASection from "@/components/CTASection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import servicesHeroImg from "@/assets/services-hero.webp";
import drivewayImg from "@/assets/services/gravel-driveway-installation.webp";
import pondImg from "@/assets/services/pond-construction.webp";
import dirtWorkImg from "@/assets/services/dirt-work.webp";
import haulingImg from "@/assets/services/aggregate-hauling.webp";
import lightClearingImg from "@/assets/projects/land-clearing.webp";

const PHONE_HREF = "tel:+12146778466";

const services = [
  {
    title: "Driveways & Private Roads",
    description: "New builds, repairs and regrading for homes, ranches and private property.",
    uses: ["New driveways", "Repairs and regrading", "Extensions", "Ranch and private roads"],
    image: drivewayImg,
  },
  {
    title: "Pond Work",
    description: "Pond excavation, grading and drainage work for rural property.",
    uses: ["Stock ponds", "Irrigation ponds", "Pond excavation", "Drainage corrections"],
    image: pondImg,
  },
  {
    title: "Dirt Work, Grading & Site Prep",
    description: "Ground preparation and shaping for practical property projects.",
    uses: ["Site preparation", "Grading and leveling", "Fill placement", "Property drainage"],
    image: dirtWorkImg,
  },
  {
    title: "Aggregate Hauling & Material Delivery",
    description: "Gravel, crushed concrete, flexbase, sand and other aggregate delivered to your site.",
    uses: ["Bulk material delivery", "Scheduled deliveries", "Job-site drops", "Aggregate hauling"],
    image: haulingImg,
  },
  {
    title: "Light Land Clearing",
    description: "Practical clearing with the equipment used for our grading and property work.",
    uses: ["Brush", "Small trees", "Rocks and boulders", "Associated site clearing"],
    image: lightClearingImg,
  },
];

const faqs = [
  {
    q: "Where do you work?",
    a: "Monkey Trucking is based in Kaufman and serves Kaufman County and surrounding DFW areas. Call with your location to confirm service.",
  },
  {
    q: "Can you deliver material without installing it?",
    a: "Yes. Material delivery can be scheduled as a standalone service, or included with driveway, road, pond and dirt work.",
  },
  {
    q: "How do I get a quote?",
    a: "Call 214-677-8466 or send a quote request with the work, material and location you have in mind.",
  },
];

const Services = () => {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <>
      <Seo
        title="Driveways, Pond Work, Grading & Hauling | Kaufman TX"
        description="Driveway and private road work, pond excavation, grading, site prep, aggregate hauling, material delivery and light land clearing near Kaufman, TX."
        path="/services"
        jsonLd={faqJsonLd}
      />

      <section className="public-page-hero">
        <img src={servicesHeroImg} alt="Monkey Trucking equipment working on a North Texas property" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-nearblack via-nearblack/75 to-nearblack/20" />
        <div className="relative mx-auto w-full max-w-[1380px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-[760px]">
            <h1 className="public-page-title">Services</h1>
            <p className="public-page-intro">Driveways, ponds, dirt work, hauling and material delivery around Kaufman.</p>
            <a href={PHONE_HREF} className="public-button public-button-primary mt-7"><Phone className="h-5 w-5" />Call 214-677-8466</a>
          </div>
        </div>
      </section>

      <section className="bg-[#efeeec] py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1280px] space-y-5 px-5 sm:px-8 lg:px-12">
          {services.map((service, index) => (
            <article key={service.title} className="grid overflow-hidden rounded-lg border border-black/10 bg-white lg:grid-cols-2">
              <div className={`min-h-[280px] sm:min-h-[360px] ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                <img src={service.image} alt={service.title} loading={index === 0 ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-12">
                <h2 className="font-heading text-[clamp(34px,4vw,52px)] uppercase leading-[0.95] text-foreground">{service.title}</h2>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">{service.description}</p>
                <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {service.uses.map((use) => (
                    <li key={use} className="flex items-center gap-3 text-base font-medium text-foreground">
                      <span className="h-2.5 w-2.5 shrink-0 bg-primary" aria-hidden="true" />
                      {use}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-[860px] px-5 sm:px-8">
          <h2 className="font-heading text-[clamp(38px,5vw,58px)] uppercase leading-none text-foreground">Before you call</h2>
          <Accordion type="single" collapsible className="mt-7 space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.q} value={`faq-${index}`} className="rounded-lg border border-black/10 bg-[#f2f1ef] px-5">
                <AccordionTrigger className="min-h-[60px] text-left font-label text-lg font-bold text-foreground hover:no-underline">{faq.q}</AccordionTrigger>
                <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <CTASection headline="Need a quote?" subtext="Call us or send the work and location you have in mind." />
    </>
  );
};

export default Services;
