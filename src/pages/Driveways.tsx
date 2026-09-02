import { BadgeCheck, CalendarDays, MapPin, MessageSquare } from "lucide-react";
import CTASection from "@/components/CTASection";
import Seo from "@/components/Seo";
import PublicReveal from "@/components/public/PublicReveal";
import QuoteRequestForm from "@/components/public/QuoteRequestForm";
import ResponsiveImage from "@/components/public/ResponsiveImage";
import TrustRail from "@/components/public/TrustRail";
import drivewayFinished from "@/assets/services/gravel-driveway-installation.webp";
import drivewayFinishedMobile from "@/assets/services/gravel-driveway-installation-768.webp";
import drivewayRegrading from "@/assets/projects/driveway-regrading.webp";
import drivewayRegradingMobile from "@/assets/projects/driveway-regrading-768.webp";
import gravelDriveway from "@/assets/projects/gravel-driveway.webp";
import gravelDrivewayMobile from "@/assets/projects/gravel-driveway-768.webp";
import gravelParkingPad from "@/assets/projects/gravel-parking-pad.webp";
import gravelParkingPadMobile from "@/assets/projects/gravel-parking-pad-768.webp";
import "@/styles/driveways.css";

const results = [
  {
    title: "Driveway regrading",
    detail: "Active grading work",
    image: drivewayRegrading,
    mobileImage: drivewayRegradingMobile,
    alt: "Monkey Trucking equipment regrading a rural driveway",
  },
  {
    title: "Finished gravel driveway",
    detail: "Completed surface",
    image: gravelDriveway,
    mobileImage: gravelDrivewayMobile,
    alt: "Completed gravel driveway with a clean, even surface",
  },
  {
    title: "Gravel parking pad",
    detail: "Completed property access",
    image: gravelParkingPad,
    mobileImage: gravelParkingPadMobile,
    alt: "Completed gravel parking pad with compact equipment nearby",
  },
];

const trustItems = [
  { title: "12+ years", line: "Serving local properties with trucking, material and site work.", icon: CalendarDays },
  { title: "100% customer satisfaction", line: "Straight answers, dependable work and a result built for the property.", icon: BadgeCheck },
  { title: "Kaufman, Texas", line: "Local service across Kaufman County and surrounding DFW areas.", icon: MapPin },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Driveway Repair and Reconstruction",
  provider: {
    "@type": "LocalBusiness",
    name: "Monkey Trucking LLC",
    telephone: "+1-214-677-8466",
    address: {
      "@type": "PostalAddress",
      streetAddress: "7653 S FM 148",
      addressLocality: "Kaufman",
      addressRegion: "TX",
      postalCode: "75142",
      addressCountry: "US",
    },
  },
  areaServed: "Kaufman County and nearby counties",
  url: "https://www.monkeytrucking.llc/driveways",
};

export default function Driveways() {
  return (
    <div className="driveway-page">
      <Seo
        title="Driveway Repair in Kaufman TX | Monkey Trucking"
        description="Washed-out driveway, potholes or standing water? Monkey Trucking rebuilds and repairs driveways throughout Kaufman County. Request a free quote."
        path="/driveways"
        ogImage={drivewayFinished}
        ogImageAlt="Finished gravel driveway by Monkey Trucking near Kaufman, Texas"
        jsonLd={structuredData}
      />

      <section className="driveway-native-hero" aria-labelledby="driveway-hero-title">
        <div className="driveway-native-hero-layout">
          <div className="driveway-native-story">
            <PublicReveal>
              <p className="font-label text-sm font-bold uppercase tracking-[0.14em] text-primary">Driveway repair · Kaufman, Texas</p>
              <h1 id="driveway-hero-title" className="font-display">A driveway that works.<br /><span>And keeps working.</span></h1>
              <p className="driveway-native-intro">Repair, regrading and new gravel driveways for homes and rural properties across Kaufman County.</p>
              <a href="sms:+12146778466" className="driveway-native-text-link"><MessageSquare aria-hidden="true" />Text 214-677-8466</a>
            </PublicReveal>

            <PublicReveal className="driveway-native-featured" delay={0.06}>
              <ResponsiveImage
                src={drivewayFinished}
                mobileSrc={drivewayFinishedMobile}
                alt="Finished gravel driveway installed by Monkey Trucking"
                decoding="async"
              />
            </PublicReveal>
          </div>

          <PublicReveal className="driveway-native-form" delay={0.1}>
            <div id="driveway-quote" className="public-contact-glass">
              <h2 className="public-contact-form-heading">Get a driveway quote</h2>
              <QuoteRequestForm
                idPrefix="driveway"
                appearance="dark"
                defaultProjectType="gravel-driveway"
                submissionOrigin="driveway_landing"
              />
            </div>
          </PublicReveal>
        </div>
      </section>

      <section className="driveway-native-results" aria-labelledby="driveway-results-title">
        <div className="driveway-native-shell">
          <PublicReveal className="driveway-native-results-heading">
            <h2 id="driveway-results-title" className="font-display">Real driveway work</h2>
            <p>Recent Monkey Trucking grading and finished-surface projects.</p>
          </PublicReveal>
          <div className="driveway-native-results-grid">
            {results.map((result, index) => (
              <PublicReveal key={result.title} className="driveway-native-result" delay={index * 0.04}>
                <ResponsiveImage src={result.image} mobileSrc={result.mobileImage} alt={result.alt} loading="lazy" decoding="async" />
                <div className="driveway-native-result-copy">
                  <p>{result.detail}</p>
                  <h3 className="font-heading">{result.title}</h3>
                </div>
              </PublicReveal>
            ))}
          </div>
          <PublicReveal className="driveway-native-pair-slot">
            <strong>Matched before + after</strong>
            <span>Reserved for verified photos from the same project.</span>
          </PublicReveal>
        </div>
      </section>

      <TrustRail items={trustItems} />

      <CTASection
        headline="Let’s get your driveway handled."
        subtext="Send the basics for a quote, or text us directly at 214-677-8466."
        quoteTo="/driveways#driveway-quote"
        quoteFirst
        showServices
      />
    </div>
  );
}
