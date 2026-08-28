import { Phone } from "lucide-react";
import Seo from "@/components/Seo";
import CTASection from "@/components/CTASection";
import MaterialCard from "@/components/MaterialCard";

import materialsHeroImg from "@/assets/materials-hero.webp";
import crushedConcreteImg from "@/assets/materials/crushed-concrete.webp";
import selectFillImg from "@/assets/materials/select-fill.webp";
import commonFillImg from "@/assets/materials/common-fill.webp";
import flexBaseImg from "@/assets/materials/flex-base.webp";
import masonSandImg from "@/assets/materials/mason-sand.webp";
import millingsImg from "@/assets/materials/millings.webp";
import nativeGravelImg from "@/assets/materials/1in-native-gravel.webp";
import nativeGravelsImg from "@/assets/materials/native-gravels.webp";
import decomposedGraniteImg from "@/assets/materials/decomposed-granite.webp";
import limestoneImg from "@/assets/materials/limestone.webp";

const PHONE_HREF = "tel:+12146778466";

const materials = [
  { name: "Commercial Crushed Concrete Clean", use: "Driveways and compactable base", image: crushedConcreteImg },
  { name: "Select Fill and Cushion Sand", use: "Fill, leveling and pipe bedding", image: selectFillImg },
  { name: "3x4 Crushed Concrete", use: "Large base, drainage and stabilization", image: commonFillImg },
  { name: 'Flexbase First Class 1" or 3"', use: "Driveways, roads and base", image: flexBaseImg },
  { name: "Mason Sand", use: "Masonry, leveling and bedding", image: masonSandImg },
  { name: 'Millings Asphalt 1/2" Minus', use: "Driveways and parking areas", image: millingsImg },
  { name: 'Native Gravel 3/8"-1"', use: "Driveways, drainage and landscaping", image: nativeGravelImg },
  { name: "Concrete Sand Mix Native Gravel", use: "Concrete mix and general aggregate use", image: nativeGravelsImg },
  { name: "Decomposed Granite", use: "Paths, patios and ground cover", image: decomposedGraniteImg },
  { name: 'Limestone 1"-1 1/2"', use: "Driveways, base and drainage", image: limestoneImg },
];

const Materials = () => (
  <>
    <Seo
      title="Gravel, Crushed Concrete & Sand | Kaufman TX"
      description="View crushed concrete, flexbase, mason sand, asphalt millings, native gravel, decomposed granite, limestone and other materials available near Kaufman, TX."
      path="/materials"
    />

    <section className="public-page-hero">
      <img src={materialsHeroImg} alt="Aggregate material being delivered by dump truck" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-nearblack via-nearblack/72 to-nearblack/15" />
      <div className="relative mx-auto w-full max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <div className="max-w-[760px]">
          <h1 className="public-page-title">Materials</h1>
          <p className="public-page-intro">Sold by the yard. Full loads available.</p>
          <a href={PHONE_HREF} className="public-button public-button-primary mt-7"><Phone className="h-5 w-5" />Call for current pricing</a>
        </div>
      </div>
    </section>

    <section className="bg-[#efeeec] py-12 sm:py-16 lg:py-20">
      <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          {materials.map((material) => <MaterialCard key={material.name} {...material} />)}
        </div>
      </div>
    </section>

    <CTASection headline="Need material delivered?" subtext="Tell us the material, amount and delivery location." />
  </>
);

export default Materials;
