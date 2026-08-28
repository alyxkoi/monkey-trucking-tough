import {
  ClipboardCheck,
  MapPin,
  Mountain,
  PackageCheck,
  Phone,
  Route,
  Truck,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";
import Seo from "@/components/Seo";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import servicesHeroImg from "@/assets/services-hero.webp";
import drivewayImg from "@/assets/services/gravel-driveway-installation.webp";
import pondImg from "@/assets/services/pond-construction.webp";
import dirtWorkImg from "@/assets/services/dirt-work.webp";
import haulingImg from "@/assets/services/aggregate-hauling.webp";

const PHONE_HREF = "tel:+12146778466";

const services: Array<{
  title: string;
  description: string;
  uses: string[];
  image: string;
  icon: LucideIcon;
}> = [
  {
    title: "Driveways & Private Roads",
    description: "New builds, repairs and regrading for homes, ranches and private property.",
    uses: ["New driveways", "Repairs and regrading", "Extensions", "Ranch and private roads"],
    image: drivewayImg,
    icon: Route,
  },
  {
    title: "Ponds",
    description: "Pond excavation, grading and drainage work for rural property.",
    uses: ["Stock ponds", "Irrigation ponds", "Pond excavation", "Drainage corrections"],
    image: pondImg,
    icon: Waves,
  },
  {
    title: "Dirt Work",
    description: "Grading, site preparation and light land clearing for practical property projects.",
    uses: ["Brush", "Small trees", "Rocks and boulders", "Associated site clearing"],
    image: dirtWorkImg,
    icon: Mountain,
  },
  {
    title: "Materials & Delivery",
    description: "Gravel, crushed concrete, flexbase, sand and other aggregate delivered to your site.",
    uses: ["Bulk material delivery", "Scheduled deliveries", "Job-site drops", "Aggregate hauling"],
    image: haulingImg,
    icon: Truck,
  },
];

const proofItems: Array<{ title: string; copy: string; icon: LucideIcon }> = [
  { title: "Local Service", copy: "Based in Kaufman, Texas", icon: MapPin },
  { title: "Upfront Quotes", copy: "Clear scope before scheduling", icon: ClipboardCheck },
  { title: "Dependable Crew", copy: "Practical property experience", icon: Users },
  { title: "Materials + Delivery", copy: "Supply and hauling together", icon: PackageCheck },
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

      <main className="public-destination-main public-services-main">
        <section className="public-services-catalog" aria-label="Monkey Trucking services">
          <div className="public-destination-container">
            <div className="public-service-grid">
              {services.map((service, index) => {
                const Icon = service.icon;
                return (
                  <article key={service.title} className="public-service-card">
                    <div className="public-service-card-media">
                      <img src={service.image} alt={`${service.title} project by Monkey Trucking`} loading={index === 0 ? "eager" : "lazy"} decoding="async" />
                    </div>
                    <div className="public-service-card-copy">
                      <div className="public-service-card-icon"><Icon aria-hidden="true" /></div>
                      <div className="public-service-card-accent" aria-hidden="true" />
                      <h2>{service.title}</h2>
                      <p>{service.description}</p>
                      <ul>
                        {service.uses.map((use) => <li key={use}>{use}</li>)}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="public-services-proof" aria-label="Service commitments">
              {proofItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="public-services-proof-item">
                    <Icon aria-hidden="true" />
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.copy}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="public-services-faq">
          <div className="public-services-faq-inner">
            <h2>Before you call</h2>
            <Accordion type="single" collapsible className="public-services-accordion">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.q} value={`faq-${index}`} className="public-services-accordion-item">
                  <AccordionTrigger className="public-services-accordion-trigger">{faq.q}</AccordionTrigger>
                  <AccordionContent className="public-services-accordion-content">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>
    </>
  );
};

export default Services;
