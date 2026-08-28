import { Phone } from "lucide-react";
import InteractiveWaves from "@/components/ui/interactive-waves";
import PublicReveal from "./PublicReveal";
import QuoteRequestForm from "./QuoteRequestForm";

type PublicContactSectionProps = {
  id?: string;
  idPrefix?: string;
  heading?: string;
  variant?: "home" | "page";
};

export default function PublicContactSection({
  id = "quote-request",
  idPrefix = "home-contact",
  heading = "Tell us what you need",
  variant = "home",
}: PublicContactSectionProps) {
  const Heading = variant === "page" ? "h1" : "h2";
  const FormHeading = variant === "page" ? "h2" : "h3";

  return (
    <section id={id} className={`public-contact-section public-contact-section-${variant}`} aria-labelledby={`${id}-heading`}>
      <InteractiveWaves lineColor="rgba(236, 236, 230, 0.15)" />
      <div className="public-contact-atmosphere" aria-hidden="true" />
      <div className="public-contact-layout">
        <PublicReveal className="public-contact-message">
          <Heading id={`${id}-heading`} className="public-contact-heading">{heading}</Heading>
          <p className="public-contact-intro">Send the material, work and location. We will follow up with the next step.</p>
          <a href="tel:+12146778466" className="public-contact-phone">
            <span className="public-contact-phone-icon"><Phone className="h-5 w-5" /></span>
            214-677-8466
          </a>
        </PublicReveal>

        <PublicReveal delay={0.08}>
          <div className="public-contact-glass">
            <FormHeading className="public-contact-form-heading">Get a quote</FormHeading>
            <QuoteRequestForm idPrefix={idPrefix} appearance="dark" />
          </div>
        </PublicReveal>
      </div>
    </section>
  );
}
