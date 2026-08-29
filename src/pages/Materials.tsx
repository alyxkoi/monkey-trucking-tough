import { Phone } from "lucide-react";
import Seo from "@/components/Seo";
import MaterialCard from "@/components/MaterialCard";
import ResponsiveImage from "@/components/public/ResponsiveImage";

import materialsHeroImg from "@/assets/materials-hero.webp";
import materialsHeroMobileImg from "@/assets/materials-hero-768.webp";
import crushedConcreteImg from "@/assets/materials/crushed-concrete.webp";
import crushedConcreteMobileImg from "@/assets/materials/crushed-concrete-768.webp";
import selectFillImg from "@/assets/materials/select-fill.webp";
import selectFillMobileImg from "@/assets/materials/select-fill-768.webp";
import commonFillImg from "@/assets/materials/common-fill.webp";
import commonFillMobileImg from "@/assets/materials/common-fill-768.webp";
import flexBaseImg from "@/assets/materials/flex-base.webp";
import flexBaseMobileImg from "@/assets/materials/flex-base-768.webp";
import masonSandImg from "@/assets/materials/mason-sand.webp";
import masonSandMobileImg from "@/assets/materials/mason-sand-768.webp";
import millingsImg from "@/assets/materials/millings.webp";
import millingsMobileImg from "@/assets/materials/millings-768.webp";
import nativeGravelImg from "@/assets/materials/1in-native-gravel.webp";
import nativeGravelMobileImg from "@/assets/materials/1in-native-gravel-768.webp";
import nativeGravelsImg from "@/assets/materials/native-gravels.webp";
import nativeGravelsMobileImg from "@/assets/materials/native-gravels-768.webp";
import decomposedGraniteImg from "@/assets/materials/decomposed-granite.webp";
import decomposedGraniteMobileImg from "@/assets/materials/decomposed-granite-768.webp";
import limestoneImg from "@/assets/materials/limestone.webp";
import limestoneMobileImg from "@/assets/materials/limestone-768.webp";

const PHONE_HREF = "tel:+12146778466";

const materials = [
  { name: "Commercial Crushed Concrete Clean", use: "Driveways and compactable base", image: crushedConcreteImg, mobileImage: crushedConcreteMobileImg },
  { name: "Select Fill and Cushion Sand", use: "Fill, leveling and pipe bedding", image: selectFillImg, mobileImage: selectFillMobileImg },
  { name: "3x4 Crushed Concrete", use: "Large base, drainage and stabilization", image: commonFillImg, mobileImage: commonFillMobileImg },
  { name: 'Flexbase First Class 1" or 3"', use: "Driveways, roads and base", image: flexBaseImg, mobileImage: flexBaseMobileImg },
  { name: "Mason Sand", use: "Masonry, leveling and bedding", image: masonSandImg, mobileImage: masonSandMobileImg },
  { name: 'Millings Asphalt 1/2" Minus', use: "Driveways and parking areas", image: millingsImg, mobileImage: millingsMobileImg },
  { name: 'Native Gravel 3/8"-1"', use: "Driveways, drainage and landscaping", image: nativeGravelImg, mobileImage: nativeGravelMobileImg },
  { name: "Concrete Sand Mix Native Gravel", use: "Concrete mix and general aggregate use", image: nativeGravelsImg, mobileImage: nativeGravelsMobileImg },
  { name: "Decomposed Granite", use: "Paths, patios and ground cover", image: decomposedGraniteImg, mobileImage: decomposedGraniteMobileImg },
  { name: 'Limestone 1"-1 1/2"', use: "Driveways, base and drainage", image: limestoneImg, mobileImage: limestoneMobileImg },
];

const Materials = () => (
  <>
    <Seo
      title="Gravel, Crushed Concrete & Sand | Kaufman TX"
      description="View crushed concrete, flexbase, mason sand, asphalt millings, native gravel, decomposed granite, limestone and other materials available near Kaufman, TX."
      path="/materials"
      ogImage={materialsHeroImg}
      ogImageAlt="Aggregate materials including crushed concrete, flexbase and gravel delivered near Kaufman, TX"
    />

    <section className="public-page-hero">
      <ResponsiveImage src={materialsHeroImg} mobileSrc={materialsHeroMobileImg} alt="Aggregate material being delivered by dump truck" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-nearblack via-nearblack/72 to-nearblack/15" />
      <div className="relative mx-auto w-full max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-[760px]">
          <h1 className="public-page-title">Materials</h1>
          <p className="public-page-intro">Sold by the yard. Full loads available.</p>
          <a href={PHONE_HREF} className="public-button public-button-primary mt-7"><Phone className="h-5 w-5" />Call for current pricing</a>
        </div>
      </div>
    </section>

    <main className="public-destination-main public-materials-main">
      <section className="public-destination-catalog" aria-label="Available aggregate materials">
        <div className="public-destination-container">
          <div className="public-material-catalog-grid">
            {materials.map((material) => <MaterialCard key={material.name} {...material} />)}
          </div>

          <div className="public-destination-cta public-materials-cta">
            <div>
              <h2>Not sure which material you need?</h2>
              <p>Tell us what you are working on and we can help you choose.</p>
            </div>
            <a href={PHONE_HREF} className="public-destination-cta-link">
              <Phone aria-hidden="true" />
              <span>Call 214-677-8466</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  </>
);

export default Materials;
