import { Phone, Construction, Droplets, Shovel, Truck, Mountain, HelpCircle } from "lucide-react";
import Seo from "@/components/Seo";
import servicesHeroImg from "@/assets/services-hero.webp";
import gravelDrivewayImg from "@/assets/services/gravel-driveway-installation.webp";
import pondConstructionImg from "@/assets/services/pond-construction.webp";
import dirtWorkImg from "@/assets/services/dirt-work.webp";
import aggregateHaulingImg from "@/assets/services/aggregate-hauling.webp";
import materialDeliveryImg from "@/assets/services/material-delivery.webp";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import CTASection from "@/components/CTASection";
import ContactActionSheet from "@/components/ContactActionSheet";

const serviceDetails = [
  {
    icon: Construction,
    title: "DRIVEWAY & PRIVATE ROAD CONSTRUCTION",
    description: "We build durable driveways and private roads designed to handle Texas weather and heavy use. From new installations to repairs and extensions, every project starts with proper grading and a solid base so your road lasts for years. Customers can choose from gravel, crushed concrete, millings, flex base, or other materials depending on their needs.",
    uses: ["New driveway and road construction", "Driveway repair and regrading", "Driveway extensions", "Ranch and farm roads"],
    bgColor: "linear-gradient(135deg, #5C5650, #8B8680)",
    image: gravelDrivewayImg,
  },
  {
    icon: Droplets,
    title: "POND CONSTRUCTION",
    description: "Professional pond excavation and construction for ranches, farms, and rural properties. We handle everything from site assessment to final grading, ensuring your pond holds water and looks great.",
    uses: ["Stock ponds for livestock", "Decorative ponds", "Irrigation ponds", "Fish ponds"],
    bgColor: "linear-gradient(135deg, #4A6741, #6B8F62)",
    image: pondConstructionImg,
  },
  {
    icon: Shovel,
    title: "DIRT WORK",
    description: "Land clearing, grading, and site prep for construction projects of all sizes. We move dirt efficiently and grade your site to proper specifications.",
    uses: ["Site preparation", "Land clearing", "Grading and leveling", "Fill dirt placement"],
    bgColor: "linear-gradient(135deg, #8B6914, #B8960F)",
    image: dirtWorkImg,
  },
  {
    icon: Truck,
    title: "AGGREGATE HAULING",
    description: "Reliable hauling of gravel, crushed concrete, flex base, sand, and other aggregate materials. We deliver on time, every time, across Kaufman County and surrounding areas.",
    uses: ["Gravel hauling", "Flex base delivery", "Crushed concrete transport", "Sand delivery"],
    bgColor: "linear-gradient(135deg, #6B4226, #8B6240)",
    image: aggregateHaulingImg,
  },
  {
    icon: Mountain,
    title: "MATERIAL DELIVERY",
    description: "Fast and reliable delivery of construction materials directly to your job site. We handle the logistics so you can focus on your project.",
    uses: ["On-site delivery", "Bulk material drops", "Scheduled deliveries", "Same-week availability"],
    bgColor: "linear-gradient(135deg, #7A7A7A, #9E9E9E)",
    image: materialDeliveryImg,
  },
];

const faqs = [
  { q: "Do you deliver gravel?", a: "Yes! We deliver gravel, flex base, crushed concrete, sand, and other aggregate materials across Kaufman County and surrounding areas within a ~30 mile radius." },
  { q: "How far do you service?", a: "We serve approximately a 30-mile radius around Kaufman, TX. This includes Terrell, Forney, Crandall, Kemp, Mabank, Canton, and nearby communities." },
  { q: "What materials do you supply?", a: "We supply gravel, flex base, crushed concrete, sand, fill dirt, and other aggregate materials for driveways, construction, and landscaping projects." },
  { q: "How do I request a quote?", a: "Simply call or text us! We'll discuss your project, provide a fair quote, and schedule the work or delivery at your convenience." },
  { q: "Do you handle both delivery and installation?", a: "Yes. We can deliver materials to your site or handle the full installation — from gravel driveways to pond construction and dirt work." },
];

const Services = () => {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <Seo
        title="Gravel Driveway Installation, Pond Construction & Excavation Near Me"
        description="Gravel driveway installation, pond construction, excavation, aggregate hauling, and gravel delivery near Kaufman, TX. Serving Kaufman County and surrounding areas."
        path="/services"
        jsonLd={faqJsonLd}
      />
      {/* Hero */}
      <section className="relative bg-industrial py-20 md:py-28 overflow-hidden">
        <img src={servicesHeroImg} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-105 opacity-30" />
        <div className="relative container mx-auto px-4">
          <h1 className="font-heading text-h1 text-white mb-4">OUR SERVICES</h1>
          <p className="text-body text-white/80 max-w-2xl mb-8">
            From gravel driveways to pond construction, Monkey Trucking handles hauling, materials, and dirt work across Kaufman County and surrounding areas. Honest pricing, reliable service.
          </p>
          <ContactActionSheet>
            {({ onClick }) => (
              <Button onClick={onClick} className="bg-primary text-primary-foreground hover:bg-primary/85 font-heading text-h4 tracking-wider px-8 h-14 min-h-[48px] transition-transform hover:-translate-y-0.5">
                <Phone className="mr-2 h-5 w-5" />
                CALL OR TEXT FOR QUOTE
              </Button>
            )}
          </ContactActionSheet>
        </div>
      </section>

      {/* Service Sections */}
      {serviceDetails.map((service, i) => (
        <div key={service.title}>
          {i > 0 && (
            <div className="container mx-auto px-4">
              <hr className="border-t border-[hsl(0,0%,78%)] opacity-50" />
            </div>
          )}
          <section className="py-10 md:py-14 bg-background">
            <div className="container mx-auto px-4">
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${i % 2 !== 0 ? "lg:grid-flow-dense" : ""}`}>
                <div className={i % 2 !== 0 ? "lg:col-start-2" : ""}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <service.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h2 className="font-heading text-h2 text-foreground">{service.title}</h2>
                  </div>
                  <p className="text-body text-muted-foreground mb-6">{service.description}</p>
                  <ul className="space-y-2 mb-8">
                    {service.uses.map((use) => (
                      <li key={use} className="flex items-center gap-2 text-body text-foreground">
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        {use}
                      </li>
                    ))}
                  </ul>
                  <ContactActionSheet>
                    {({ onClick }) => (
                      <Button onClick={onClick} className="bg-primary text-primary-foreground hover:bg-primary/85 font-heading text-h4 tracking-wider px-6 h-12 min-h-[48px] transition-transform hover:-translate-y-0.5">
                        <Phone className="mr-2 h-5 w-5" />
                        CALL OR TEXT FOR QUOTE
                      </Button>
                    )}
                  </ContactActionSheet>
                </div>
                <div
                  className={`h-64 md:h-80 rounded-lg overflow-hidden ${i % 2 !== 0 ? "lg:col-start-1" : ""}`}
                  style={{ background: service.bgColor }}
                >
                  {service.image && (
                    <img src={service.image} alt={service.title} className="w-full h-full object-cover" />
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      ))}

      {/* FAQ */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <HelpCircle className="h-8 w-8 text-primary" />
            <h2 className="font-heading text-h2 text-foreground">FREQUENTLY ASKED QUESTIONS</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="faq-aluminum-panel rounded-lg px-5 py-1 border-0">
                <AccordionTrigger className="font-heading text-lg md:text-xl tracking-wide text-[hsl(0,0%,7%)] hover:no-underline [&>svg]:faq-chevron">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-body text-[hsl(0,0%,25%)] pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <CTASection
        headline="READY TO GET STARTED?"
        subtext="Call or text Monkey Trucking for a free quote on your next project."
      />
    </>
  );
};

export default Services;
