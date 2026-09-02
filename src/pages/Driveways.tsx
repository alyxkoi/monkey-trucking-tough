import { useState } from "react";
import { ArrowRight, Check, MapPin, MessageSquare, Phone, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import PublicReveal from "@/components/public/PublicReveal";
import ResponsiveImage from "@/components/public/ResponsiveImage";
import DrivewayQuoteForm from "@/components/driveways/DrivewayQuoteForm";
import logo from "@/assets/monkey-trucking-logo.webp";
import drivewayFinished from "@/assets/services/gravel-driveway-installation.webp";
import drivewayFinishedMobile from "@/assets/services/gravel-driveway-installation-768.webp";
import drivewayRegrading from "@/assets/projects/driveway-regrading.webp";
import drivewayRegradingMobile from "@/assets/projects/driveway-regrading-768.webp";
import gravelDriveway from "@/assets/projects/gravel-driveway.webp";
import gravelDrivewayMobile from "@/assets/projects/gravel-driveway-768.webp";
import gravelParkingPad from "@/assets/projects/gravel-parking-pad.webp";
import gravelParkingPadMobile from "@/assets/projects/gravel-parking-pad-768.webp";
import aggregateHauling from "@/assets/services/aggregate-hauling.webp";
import aggregateHaulingMobile from "@/assets/services/aggregate-hauling-768.webp";
import flexBase from "@/assets/materials/flex-base.webp";
import "@/styles/driveways.css";

const PHONE_HREF = "tel:+12146778466";
const SMS_HREF = "sms:+12146778466";

const proofProjects = [
  {
    number: "01",
    title: "Driveway Regrading",
    description: "Existing surface reshaped and prepared for a cleaner, more dependable drive.",
    image: drivewayRegrading,
    mobileImage: drivewayRegradingMobile,
    alt: "Monkey Trucking equipment regrading a rural driveway",
  },
  {
    number: "02",
    title: "New Gravel Driveway",
    description: "A finished gravel surface shaped for practical access and a clean approach.",
    image: gravelDriveway,
    mobileImage: gravelDrivewayMobile,
    alt: "A completed gravel driveway photographed from above",
  },
  {
    number: "03",
    title: "Gravel Parking Pad",
    description: "Fresh aggregate placed and finished for a stable property parking area.",
    image: gravelParkingPad,
    mobileImage: gravelParkingPadMobile,
    alt: "A completed gravel parking pad with compact equipment nearby",
  },
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
  const [formActive, setFormActive] = useState(false);

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

      <header className="driveway-campaign-header">
        <Link to="/" className="driveway-header-brand" aria-label="Monkey Trucking home">
          <img src={logo} alt="Monkey Trucking LLC" />
          <span><MapPin aria-hidden="true" />Kaufman, Texas</span>
        </Link>
        <div className="driveway-header-actions">
          <a href={PHONE_HREF} className="driveway-header-phone" aria-label="Call Monkey Trucking at 214-677-8466"><Phone aria-hidden="true" /><span>214-677-8466</span></a>
          <a href="#driveway-quote" className="driveway-header-quote">Get quote</a>
        </div>
      </header>

      <main>
        <section className="driveway-hero" aria-labelledby="driveway-hero-title">
          <div className="driveway-hero-grid">
            <div className="driveway-hero-story">
              <PublicReveal>
                <p className="driveway-eyebrow">DRIVEWAY REPAIR / KAUFMAN COUNTY</p>
                <h1 id="driveway-hero-title">FIX IT BEFORE<br /><span>THE NEXT STORM.</span></h1>
                <p className="driveway-hero-intro">Potholes, standing water or a washed-out driveway? We rebuild Texas driveways with the right material, grade and equipment.</p>
              </PublicReveal>

              <PublicReveal className="driveway-hero-proof" delay={0.08}>
                <figure className="driveway-proof-frame driveway-proof-build">
                  <ResponsiveImage
                    src={drivewayRegrading}
                    mobileSrc={drivewayRegradingMobile}
                    alt="Driveway surface being regraded by Monkey Trucking"
                    decoding="async"
                  />
                  <figcaption><span>THE FIX</span> Regrading in progress</figcaption>
                </figure>
                <figure className="driveway-proof-frame driveway-proof-finish">
                  <ResponsiveImage
                    src={drivewayFinished}
                    mobileSrc={drivewayFinishedMobile}
                    alt="Finished gravel driveway by Monkey Trucking"
                    decoding="async"
                  />
                  <figcaption><span>THE FINISH</span> Clean gravel surface</figcaption>
                </figure>
              </PublicReveal>
              <p className="driveway-photo-note">Real Monkey Trucking work shown from separate projects.</p>
            </div>

            <PublicReveal className="driveway-hero-form-wrap" delay={0.12}>
              <DrivewayQuoteForm onInteractionChange={setFormActive} />
              <div className="driveway-trust-line" aria-label="Monkey Trucking service advantages">
                <span><MapPin aria-hidden="true" />Local crew</span>
                <span><Truck aria-hidden="true" />Our trucks</span>
                <span><Check aria-hidden="true" />Material from our plant</span>
              </div>
            </PublicReveal>
          </div>
        </section>

        <section className="driveway-work" aria-labelledby="driveway-work-title">
          <div className="driveway-section-shell">
            <PublicReveal className="driveway-section-heading">
              <p className="driveway-eyebrow">REAL WORK / REAL RESULTS</p>
              <h2 id="driveway-work-title">SEE THE DIFFERENCE.</h2>
              <p>Real driveway work from the Monkey Trucking project gallery. No stock photos.</p>
            </PublicReveal>

            <div className="driveway-work-grid">
              {proofProjects.map((project, index) => (
                <PublicReveal key={project.number} className={`driveway-work-item driveway-work-item-${index + 1}`} delay={index * 0.05}>
                  <div className="driveway-work-media">
                    <ResponsiveImage src={project.image} mobileSrc={project.mobileImage} alt={project.alt} loading="lazy" decoding="async" />
                  </div>
                  <div className="driveway-work-copy">
                    <span>PROJECT {project.number}</span>
                    <h3>{project.title}</h3>
                    <p>{project.description}</p>
                  </div>
                </PublicReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="driveway-why" aria-labelledby="driveway-why-title">
          <div className="driveway-why-media">
            <ResponsiveImage src={aggregateHauling} mobileSrc={aggregateHaulingMobile} alt="Monkey Trucking hauling material to a local property" loading="lazy" decoding="async" />
            <img src={flexBase} alt="" className="driveway-material-pile" loading="lazy" decoding="async" />
            <span className="driveway-plant-stamp">FROM OUR PLANT</span>
          </div>
          <div className="driveway-why-copy">
            <PublicReveal>
              <p className="driveway-eyebrow">WHY MONKEY TRUCKING</p>
              <h2 id="driveway-why-title">OUR MATERIAL.<br />OUR TRUCKS.<br /><span>OUR CREW.</span></h2>
            </PublicReveal>
            <div className="driveway-reasons">
              <PublicReveal>
                <span>01</span><div><h3>From our own plant</h3><p>We control access to the material and haul it with our own trucks.</p></div>
              </PublicReveal>
              <PublicReveal delay={0.05}>
                <span>02</span><div><h3>Built for Texas weather</h3><p>Material selection and grading matter when heavy rain arrives.</p></div>
              </PublicReveal>
              <PublicReveal delay={0.1}>
                <span>03</span><div><h3>Local equipment and crew</h3><p>Based in Kaufman and serving Kaufman County and nearby counties.</p></div>
              </PublicReveal>
            </div>
          </div>
        </section>

        <section className="driveway-process" aria-labelledby="driveway-process-title">
          <div className="driveway-section-shell">
            <PublicReveal className="driveway-process-lead">
              <p className="driveway-eyebrow">LOCAL CREW / STRAIGHT ANSWERS</p>
              <h2 id="driveway-process-title">THREE STEPS.<br /><span>NO RUNAROUND.</span></h2>
              <p>Send the basics now. We will help determine the right material and work for the driveway.</p>
              <a href={SMS_HREF} className="driveway-text-link"><MessageSquare aria-hidden="true" />Prefer to text? 214-677-8466</a>
            </PublicReveal>
            <div className="driveway-process-steps">
              {[
                ["01", "Send us your driveway", "Share your name, phone and location."],
                ["02", "Get your quote", "We determine the appropriate work and material."],
                ["03", "Get it fixed", "Schedule the work and get the driveway handled."],
              ].map(([number, title, description], index) => (
                <PublicReveal key={number} className="driveway-process-step" delay={index * 0.05}>
                  <span>{number}</span><h3>{title}</h3><p>{description}</p>
                </PublicReveal>
              ))}
            </div>
          </div>
        </section>

        <section className="driveway-final" aria-labelledby="driveway-final-title">
          <ResponsiveImage src={drivewayFinished} mobileSrc={drivewayFinishedMobile} alt="Finished gravel driveway near Kaufman, Texas" loading="lazy" decoding="async" className="driveway-final-image" />
          <div className="driveway-final-overlay" />
          <PublicReveal className="driveway-final-copy">
            <p className="driveway-eyebrow">RAIN&apos;S COMING.</p>
            <h2 id="driveway-final-title">DON&apos;T WAIT UNTIL<br /><span>IT GETS WORSE.</span></h2>
            <p>Send us a few details and we&apos;ll help you figure out what your driveway needs.</p>
            <div className="driveway-final-actions">
              <a href="#driveway-quote" className="driveway-primary-button">Get a free quote <ArrowRight aria-hidden="true" /></a>
              <a href={PHONE_HREF} className="driveway-secondary-button"><Phone aria-hidden="true" />Call 214-677-8466</a>
              <a href={SMS_HREF} className="driveway-secondary-button"><MessageSquare aria-hidden="true" />Text us</a>
            </div>
            <Link to="/" className="driveway-full-site-link">Want to learn more? Visit the full Monkey Trucking website <ArrowRight aria-hidden="true" /></Link>
          </PublicReveal>
        </section>
      </main>

      <footer className="driveway-footer">
        <img src={logo} alt="Monkey Trucking LLC" />
        <p>7653 S FM 148, Kaufman, TX 75142</p>
        <div><Link to="/privacy-policy">Privacy Policy</Link><Link to="/terms">Terms</Link><Link to="/">Full website</Link></div>
      </footer>

      <div className={`driveway-mobile-actions ${formActive ? "driveway-mobile-actions-hidden" : ""}`} aria-hidden={formActive || undefined}>
        <a href="#driveway-quote">Get quote</a>
        <a href={PHONE_HREF}><Phone aria-hidden="true" />Call</a>
        <a href={SMS_HREF}><MessageSquare aria-hidden="true" />Text</a>
      </div>
    </div>
  );
}
