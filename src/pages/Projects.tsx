import { useState } from "react";
import { Phone } from "lucide-react";
import Seo from "@/components/Seo";
import CTASection from "@/components/CTASection";
import ProjectCard from "@/components/ProjectCard";

import projectsHeroImg from "@/assets/projects-hero.webp";
import gravelDrivewayImg from "@/assets/projects/gravel-driveway.webp";
import drivewayRegradingImg from "@/assets/projects/driveway-regrading.webp";
import masonSandDeliveryImg from "@/assets/projects/mason-sand-delivery.webp";
import stockPondImg from "@/assets/projects/stock-pond-excavation.webp";
import crushedConcreteImg from "@/assets/projects/crushed-concrete-delivery.webp";
import ranchRoadImg from "@/assets/projects/ranch-road-repair.webp";
import landClearingImg from "@/assets/projects/land-clearing.webp";
import pondDrainageImg from "@/assets/projects/pond-drainage-fix.webp";
import gravelParkingImg from "@/assets/projects/gravel-parking-pad.webp";

const PHONE_HREF = "tel:+12146778466";
const filters = ["All", "Driveways", "Ponds", "Delivery", "Dirt Work"] as const;
type ProjectFilter = (typeof filters)[number];

const projects: Array<{ title: string; category: Exclude<ProjectFilter, "All">; image: string }> = [
  { title: "New Gravel Driveway", category: "Driveways", image: gravelDrivewayImg },
  { title: "Stock Pond Excavation", category: "Ponds", image: stockPondImg },
  { title: "Crushed Concrete Delivery", category: "Delivery", image: crushedConcreteImg },
  { title: "Ranch Road Repair", category: "Dirt Work", image: ranchRoadImg },
  { title: "Driveway Regrading", category: "Driveways", image: drivewayRegradingImg },
  { title: "Pond Drainage Fix", category: "Ponds", image: pondDrainageImg },
  { title: "Mason Sand Delivery", category: "Delivery", image: masonSandDeliveryImg },
  { title: "Light Clearing & Grading", category: "Dirt Work", image: landClearingImg },
  { title: "Gravel Parking Pad", category: "Driveways", image: gravelParkingImg },
];

const Projects = () => {
  const [filter, setFilter] = useState<ProjectFilter>("All");
  const visibleProjects = filter === "All" ? projects : projects.filter((project) => project.category === filter);

  return (
    <>
      <Seo
        title="Driveway, Pond & Dirt Work Projects | Kaufman TX"
        description="View recent driveway work, pond excavation, material deliveries, grading and light land clearing near Kaufman, Texas."
        path="/projects"
      />

      <section className="public-page-hero">
        <img src={projectsHeroImg} alt="Completed Monkey Trucking property project" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-nearblack via-nearblack/72 to-nearblack/15" />
        <div className="relative mx-auto w-full max-w-[1380px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-[760px]">
            <h1 className="public-page-title">Our work</h1>
            <p className="public-page-intro">Driveways, ponds, deliveries and dirt work completed around North Texas.</p>
            <a href={PHONE_HREF} className="public-button public-button-primary mt-7"><Phone className="h-5 w-5" />Call 214-677-8466</a>
          </div>
        </div>
      </section>

      <section className="bg-[#efeeec] py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
          <div className="flex max-w-full gap-2 overflow-x-auto pb-2" role="group" aria-label="Filter projects">
            {filters.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
                className={`min-h-12 shrink-0 rounded-md px-5 font-label text-base font-bold transition-colors ${filter === option ? "bg-primary text-white" : "border border-black/15 bg-white text-foreground hover:border-primary"}`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {visibleProjects.map((project) => <ProjectCard key={project.title} {...project} />)}
          </div>
        </div>
      </section>

      <CTASection headline="Have a project in mind?" subtext="Call us or send a quote request with your location and what needs to be done." />
    </>
  );
};

export default Projects;
