import Seo from "@/components/Seo";
import HomeHero from "@/components/public/HomeHero";
import PopularMaterialsSection from "@/components/public/PopularMaterialsSection";
import PublicContactSection from "@/components/public/PublicContactSection";
import RecentWorkSection from "@/components/public/RecentWorkSection";
import ServiceFeatureGrid from "@/components/public/ServiceFeatureGrid";
import TrustRail from "@/components/public/TrustRail";
import homeOgImg from "@/assets/projects/gravel-driveway.webp";

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
        ogImage={homeOgImg}
        ogImageAlt="Freshly built gravel driveway by Monkey Trucking near Kaufman, Texas"
        jsonLd={homeJsonLd}
      />

    <HomeHero />
    <ServiceFeatureGrid />
    <PopularMaterialsSection />
    <RecentWorkSection />
    <TrustRail />
    <PublicContactSection />
  </>
);

export default Index;
