import { ArrowRight, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
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

const projects = [
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

const Projects = () => (
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

    <main className="public-destination-main public-projects-main">
        <section className="public-destination-catalog" aria-label="Recent Monkey Trucking projects">
          <div className="public-destination-container">
            <div className="public-project-grid">
              {projects.map((project) => <ProjectCard key={project.title} {...project} />)}
            </div>

            <div className="public-destination-cta public-projects-cta">
              <div>
                <h2>Have a project in mind?</h2>
                <p>Send the work and location you have in mind. We will help you plan the next step.</p>
              </div>
              <Link to="/contact" className="public-destination-cta-link">
                <span>Get a Quote</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
    </main>
  </>
);

export default Projects;
