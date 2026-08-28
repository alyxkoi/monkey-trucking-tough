import aggregateHaulingImg from "@/assets/services/aggregate-hauling.webp";
import drivewayImg from "@/assets/services/gravel-driveway-installation.webp";
import pondImg from "@/assets/services/pond-construction.webp";
import dirtWorkImg from "@/assets/services/dirt-work.webp";
import materialDeliveryImg from "@/assets/services/material-delivery.webp";
import gravelDrivewayImg from "@/assets/projects/gravel-driveway.webp";
import drivewayRegradingImg from "@/assets/projects/driveway-regrading.webp";
import stockPondImg from "@/assets/projects/stock-pond-excavation.webp";
import pondDrainageImg from "@/assets/projects/pond-drainage-fix.webp";
import crushedConcreteDeliveryImg from "@/assets/projects/crushed-concrete-delivery.webp";
import ranchRoadImg from "@/assets/projects/ranch-road-repair.webp";
import landClearingImg from "@/assets/projects/land-clearing.webp";
import masonSandDeliveryImg from "@/assets/projects/mason-sand-delivery.webp";
import flexBaseImg from "@/assets/materials/flex-base.webp";
import crushedConcreteImg from "@/assets/materials/crushed-concrete.webp";
import masonSandImg from "@/assets/materials/mason-sand.webp";
import millingsImg from "@/assets/materials/millings.webp";
import nativeGravelImg from "@/assets/materials/1in-native-gravel.webp";
import decomposedGraniteImg from "@/assets/materials/decomposed-granite.webp";

export type PublicServiceFeature = {
  id: string;
  title: string;
  summary: string;
  description: string;
  capabilities: string[];
  image: string;
  supportingImages: string[];
  to: string;
};

export const publicServiceFeatures: PublicServiceFeature[] = [
  {
    id: "materials-delivery",
    title: "Materials & Delivery",
    summary: "Aggregate delivered where you need it.",
    description: "Choose the material and delivery location. We will confirm availability, load size and access before scheduling.",
    capabilities: ["Bulk aggregate delivery", "Job site drops", "Driveway materials", "Sand and base materials"],
    image: aggregateHaulingImg,
    supportingImages: [materialDeliveryImg, crushedConcreteDeliveryImg],
    to: "/materials",
  },
  {
    id: "driveways-roads",
    title: "Driveways & Roads",
    summary: "New builds, repairs and regrading.",
    description: "New surfaces, repairs and regrading for homes, ranches and private property access.",
    capabilities: ["New driveways", "Private roads", "Repairs and regrading", "Driveway extensions"],
    image: drivewayImg,
    supportingImages: [gravelDrivewayImg, drivewayRegradingImg],
    to: "/services",
  },
  {
    id: "ponds",
    title: "Ponds",
    summary: "Excavation, shaping and drainage work.",
    description: "Pond excavation, shaping and practical drainage corrections for rural property.",
    capabilities: ["Stock ponds", "Pond excavation", "Bank shaping", "Drainage corrections"],
    image: pondImg,
    supportingImages: [stockPondImg, pondDrainageImg],
    to: "/services",
  },
  {
    id: "dirt-work",
    title: "Dirt Work",
    summary: "Grading, site prep and light clearing.",
    description: "Ground shaping and preparation for practical property work, including brush, small trees, rocks and boulders when appropriate.",
    capabilities: ["Site preparation", "Grading and leveling", "Fill placement", "Light associated clearing"],
    image: dirtWorkImg,
    supportingImages: [ranchRoadImg, landClearingImg],
    to: "/services",
  },
];

export type PopularMaterial = {
  id: string;
  name: string;
  use: string;
  image: string;
  jobImage: string | null;
  jobImageAlt: string | null;
};

export const popularMaterials: PopularMaterial[] = [
  {
    id: "flexbase",
    name: 'Flexbase First Class 1" or 3"',
    use: "Driveways and compactable base.",
    image: flexBaseImg,
    jobImage: gravelDrivewayImg,
    jobImageAlt: "Completed gravel driveway",
  },
  {
    id: "crushed-concrete",
    name: "Commercial Crushed Concrete Clean",
    use: "Driveways and stable base.",
    image: crushedConcreteImg,
    jobImage: crushedConcreteDeliveryImg,
    jobImageAlt: "Crushed concrete delivered to a property",
  },
  {
    id: "mason-sand",
    name: "Mason Sand",
    use: "Masonry, bedding and leveling.",
    image: masonSandImg,
    jobImage: masonSandDeliveryImg,
    jobImageAlt: "Mason sand delivery",
  },
  {
    id: "millings",
    name: 'Millings Asphalt 1/2" Minus',
    use: "Driveways and parking areas.",
    image: millingsImg,
    jobImage: null,
    jobImageAlt: null,
  },
  {
    id: "native-gravel",
    name: 'Native Gravel 3/8"-1"',
    use: "Driveways, drainage and landscaping.",
    image: nativeGravelImg,
    jobImage: null,
    jobImageAlt: null,
  },
  {
    id: "decomposed-granite",
    name: "Decomposed Granite",
    use: "Paths, patios and ground cover.",
    image: decomposedGraniteImg,
    jobImage: null,
    jobImageAlt: null,
  },
];

export type RecentWorkProject = {
  id: string;
  title: string;
  category: string;
  description: string;
  image: string;
};

export const recentWorkProjects: RecentWorkProject[] = [
  {
    id: "gravel-driveway",
    title: "New Gravel Driveway",
    category: "Driveways",
    description: "A finished gravel surface shaped for practical access and a clean approach to the property.",
    image: gravelDrivewayImg,
  },
  {
    id: "stock-pond",
    title: "Stock Pond Excavation",
    category: "Ponds",
    description: "Pond excavation and shaping completed for rural property use.",
    image: stockPondImg,
  },
  {
    id: "crushed-concrete-delivery",
    title: "Crushed Concrete Delivery",
    category: "Delivery",
    description: "Crushed concrete delivered to the property and placed where the customer needed it.",
    image: crushedConcreteDeliveryImg,
  },
  {
    id: "ranch-road",
    title: "Ranch Road Repair",
    category: "Dirt Work",
    description: "A private road surface repaired and graded for dependable property access.",
    image: ranchRoadImg,
  },
  {
    id: "light-clearing",
    title: "Light Clearing & Grading",
    category: "Dirt Work",
    description: "Brush and surface material cleared as part of practical grading and site preparation.",
    image: landClearingImg,
  },
  {
    id: "mason-sand-delivery",
    title: "Mason Sand Delivery",
    category: "Delivery",
    description: "Mason sand delivered for the customer supplied project needs.",
    image: masonSandDeliveryImg,
  },
];
