import Seo from "@/components/Seo";
import PublicContactSection from "@/components/public/PublicContactSection";
import contactOgImg from "@/assets/contact-hero.webp";

const Contact = () => (
  <>
    <Seo
      title="Request a Gravel, Driveway or Dirt Work Quote | Kaufman TX"
      description="Call Monkey Trucking or request a quote for material delivery, driveway work, pond work, grading, hauling or light land clearing near Kaufman, TX."
      path="/contact"
      ogImage={contactOgImg}
      ogImageAlt="Monkey Trucking truck ready for material delivery near Kaufman, TX"
    />

    <PublicContactSection id="contact-quote" idPrefix="contact" variant="page" />
  </>
);

export default Contact;
