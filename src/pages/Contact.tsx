import { Phone } from "lucide-react";
import Seo from "@/components/Seo";
import PublicContactSection from "@/components/public/PublicContactSection";
import contactHeroImg from "@/assets/contact-hero.webp";

const Contact = () => (
  <>
    <Seo
      title="Request a Gravel, Driveway or Dirt Work Quote | Kaufman TX"
      description="Call Monkey Trucking or request a quote for material delivery, driveway work, pond work, grading, hauling or light land clearing near Kaufman, TX."
      path="/contact"
    />

    <section className="public-page-hero min-h-[410px]">
      <img src={contactHeroImg} alt="Monkey Trucking dump truck ready for material delivery" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-nearblack via-nearblack/76 to-nearblack/20" />
      <div className="relative mx-auto w-full max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-[760px]">
          <h1 className="public-page-title">Tell us what you need</h1>
          <p className="public-page-intro">Call now or send the project, material and location below.</p>
          <a href="tel:+12146778466" className="public-button public-button-primary mt-7"><Phone className="h-5 w-5" />Call 214-677-8466</a>
        </div>
      </div>
    </section>

    <PublicContactSection id="contact-quote" idPrefix="contact" heading="Get a quote" />
  </>
);

export default Contact;
