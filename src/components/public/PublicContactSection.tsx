import { Phone } from "lucide-react";
import PublicReveal from "./PublicReveal";
import QuoteRequestForm from "./QuoteRequestForm";
import VerticalBarsNoise from "./VerticalBarsNoise";

type PublicContactSectionProps = {
  id?: string;
  idPrefix?: string;
  heading?: string;
};

export default function PublicContactSection({ id = "quote-request", idPrefix = "home-contact", heading = "Tell us what you need" }: PublicContactSectionProps) {
  return (
    <section id={id} className="relative isolate overflow-hidden bg-[#0f0f11] py-16 text-white sm:py-20 lg:py-24" aria-labelledby={`${id}-heading`}>
      <VerticalBarsNoise removeWaveLine animationSpeed={0.14} lineColor="rgba(238, 238, 234, 0.075)" barColor="rgba(238, 238, 234, 0.035)" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f11]/40 via-[#0f0f11]/[0.28] to-[#0f0f11]/[0.76]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-[1380px] grid-cols-1 gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)] lg:items-start lg:gap-14 lg:px-12">
        <PublicReveal className="lg:sticky lg:top-[118px]">
          <h2 id={`${id}-heading`} className="max-w-[620px] font-heading text-[clamp(48px,7vw,88px)] uppercase leading-[0.88] text-white">{heading}</h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-white/[0.68]">Send the material, work and location. We will follow up about the next step.</p>
          <a href="tel:+12146778466" className="mt-8 inline-flex min-h-14 items-center gap-4 font-heading text-[clamp(28px,4vw,44px)] tracking-wide text-white transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="flex h-12 w-12 items-center justify-center bg-primary text-white"><Phone className="h-5 w-5" /></span>
            214-677-8466
          </a>
        </PublicReveal>

        <PublicReveal delay={0.08}>
          <div className="public-contact-glass p-5 sm:p-8 lg:p-10">
            <h3 className="mb-7 font-heading text-[clamp(34px,5vw,52px)] uppercase leading-none text-white">Get a quote</h3>
            <QuoteRequestForm idPrefix={idPrefix} appearance="dark" />
          </div>
        </PublicReveal>
      </div>
    </section>
  );
}
