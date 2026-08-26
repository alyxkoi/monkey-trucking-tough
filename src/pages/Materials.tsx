import { Phone, CheckCircle } from "lucide-react";
import Seo from "@/components/Seo";
import materialsHeroImg from "@/assets/materials-hero.webp";
import { Button } from "@/components/ui/button";
import MaterialCard from "@/components/MaterialCard";
import CTASection from "@/components/CTASection";
import ContactActionSheet from "@/components/ContactActionSheet";
import millingsImg from "@/assets/materials/millings.webp";
import nativeGravelsImg from "@/assets/materials/1in-native-gravel.webp";
import decomposedGraniteImg from "@/assets/materials/decomposed-granite.webp";
import masonSandImg from "@/assets/materials/mason-sand.webp";
import flexBaseImg from "@/assets/materials/flex-base.webp";
import crushedConcreteImg from "@/assets/materials/crushed-concrete.webp";
import cushionSandImg from "@/assets/materials/cushion-sand.webp";
import limestoneImg from "@/assets/materials/limestone.webp";
import topSoilImg from "@/assets/materials/top-soil.webp";

const STORAGE_BASE = "https://ssuciilipipwlakpwhim.supabase.co/storage/v1/object/public/images/materialzoomins";

const zoomMillings = `${STORAGE_BASE}/millings.jpeg`;
const zoomNativeGravel = `${STORAGE_BASE}/native%20gravel.jpeg`;
const zoomDecomposedGranite = `${STORAGE_BASE}/decomposed%20granite.jpeg`;
const zoomMasonSand = `${STORAGE_BASE}/mason%20sand.jpeg`;
const zoomFlexBase = `${STORAGE_BASE}/flex%20base.jpeg`;
const zoomCrushedConcrete = `${STORAGE_BASE}/crushed%20concrete.jpeg`;
const zoomCushionSand = `${STORAGE_BASE}/cushion%20sand.jpeg`;
const zoomLimestone = `${STORAGE_BASE}/limestone.jpeg`;
const zoomTopSoil = `${STORAGE_BASE}/top%20soil.jpeg`;

const materials = [
  {
    name: "MILLINGS",
    description: "Recycled asphalt millings — an affordable, durable option for driveways and parking areas.",
    uses: "Driveways, parking pads, road base, paths",
    image: millingsImg,
    tint: "#ededed",
    projectImage: zoomMillings,
  },
  {
    name: "NATIVE GRAVELS",
    description: "Clean, durable native gravels available in multiple sizes, ideal for driveways, drainage, and landscaping projects.",
    uses: "Driveways, drainage, landscaping, pathways",
    sizes: '1", 2", and 3"',
    image: nativeGravelsImg,
    tint: "#eeedeb",
    projectImage: zoomNativeGravel,
  },
  {
    name: "DECOMPOSED GRANITE",
    description: "Finely crushed granite ideal for walkways, patios, and decorative landscaping.",
    uses: "Walkways, patios, landscaping, ground cover",
    image: decomposedGraniteImg,
    tint: "#f2ece4",
    projectImage: zoomDecomposedGranite,
  },
  {
    name: "MASON SAND",
    description: "Fine, clean sand perfect for masonry, leveling, and construction projects.",
    uses: "Masonry, leveling, construction base, fill",
    image: masonSandImg,
    tint: "#f5efe5",
    projectImage: zoomMasonSand,
  },
  {
    name: "FLEX BASE",
    description: "Compactable limestone base material that creates a solid, durable foundation for any project.",
    uses: "Road base, parking areas, building foundations, pads",
    image: flexBaseImg,
    tint: "#f0ebe3",
    projectImage: zoomFlexBase,
  },
  {
    name: "CRUSHED CONCRETE",
    description: "Recycled concrete aggregate — an affordable, eco-friendly option for driveways and base layers.",
    uses: "Driveways, parking pads, base layers, fill material",
    image: crushedConcreteImg,
    tint: "#efefef",
    projectImage: zoomCrushedConcrete,
  },
  {
    name: "CUSHION SAND",
    description: "Clean, fine cushion sand commonly used for pipe bedding, trench backfill, and leveling applications.",
    uses: "Pipe bedding, trench fill, leveling, utility work",
    image: cushionSandImg,
    tint: "#f5f0e8",
    projectImage: zoomCushionSand,
  },
  {
    name: "LIMESTONE",
    description: "Crushed limestone that compacts well, making it a reliable choice for driveways, base layers, and construction projects.",
    uses: "Driveways, road base, foundations, pathways",
    image: limestoneImg,
    tint: "#e8e6e2",
    projectImage: zoomLimestone,
  },
  {
    name: "TOP SOIL",
    description: "Rich, organic topsoil ideal for landscaping, grading, and lawn preparation.",
    uses: "Landscaping, lawns, gardens, final grading",
    image: topSoilImg,
    tint: "#e8e4de",
    projectImage: zoomTopSoil,
  },
];

const commonUses = [
  "Driveway installation and repair",
  "Parking pads and areas",
  "Road and foundation base layers",
  "Drainage improvements",
  "Landscaping and fill",
  "Site preparation and leveling",
];

const Materials = () => {
  return (
    <>
      <Seo
        title="Gravel, Crushed Concrete & Sand Delivery Near Me | Kaufman TX"
        description="Gravel delivery near Kaufman, TX: native gravel, crushed concrete, flex base, mason sand, decomposed granite, millings, limestone, and topsoil. Fast aggregate hauling."
        path="/materials"
      />
      {/* Hero with gravel text */}
      <section className="relative bg-industrial py-20 md:py-28 overflow-hidden">
        <img src={materialsHeroImg} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-105 opacity-30" />
        <div className="relative container mx-auto px-4">
          <h1 className="font-heading text-h1 text-white mb-4">MATERIALS WE SUPPLY</h1>
          <p className="text-body text-white/80 max-w-2xl mb-8">
            Quality aggregates and construction materials delivered to your job site in Kaufman County and surrounding areas.
          </p>
          <ContactActionSheet>
            {({ onClick }) => (
              <Button onClick={onClick} className="bg-primary text-primary-foreground hover:bg-primary/85 font-heading text-h4 tracking-wider px-8 h-14 min-h-[48px] transition-transform hover:-translate-y-0.5">
                <Phone className="mr-2 h-5 w-5" />
                REQUEST MATERIAL DELIVERY
              </Button>
            )}
          </ContactActionSheet>
        </div>
      </section>

      {/* Materials Grid */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-h2 text-foreground text-center mb-4">AVAILABLE MATERIALS</h2>
          <p className="text-body text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            We supply and deliver a range of aggregate materials for construction, driveways, and land projects.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {materials.map((material) => (
              <MaterialCard key={material.name} {...material} />
            ))}
          </div>
        </div>
      </section>

      {/* Common Uses */}
      <section className="py-16 md:py-20 bg-light-gray">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-h2 text-foreground text-center mb-4">COMMON USES FOR OUR MATERIALS</h2>
          <p className="text-body text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Our materials are used across a wide range of residential and commercial projects.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {commonUses.map((use) => (
              <div key={use} className="flex items-center gap-3 bg-industrial border border-industrial rounded-lg p-4">
                <CheckCircle className="h-5 w-5 text-primary shrink-0" />
                <span className="text-body text-industrial-foreground font-medium">{use}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <CTASection
        headline="NEED MATERIAL DELIVERED?"
        subtext="Call or text Monkey Trucking for fast aggregate delivery across Kaufman County."
      />
    </>
  );
};

export default Materials;
