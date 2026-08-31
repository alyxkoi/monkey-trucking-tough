import { ArrowRight, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import ProjectCard from "@/components/ProjectCard";
import ResponsiveImage from "@/components/public/ResponsiveImage";

import projectsHeroImg from "@/assets/projects-hero.webp";
import projectsHeroMobileImg from "@/assets/projects-hero-768.webp";
import gravelDrivewayImg from "@/assets/projects/gravel-driveway.webp";
import gravelDrivewayMobileImg from "@/assets/projects/gravel-driveway-768.webp";
import drivewayRegradingImg from "@/assets/projects/driveway-regrading.webp";
import drivewayRegradingMobileImg from "@/assets/projects/driveway-regrading-768.webp";
import masonSandDeliveryImg from "@/assets/projects/mason-sand-delivery.webp";
import masonSandDeliveryMobileImg from "@/assets/projects/mason-sand-delivery-768.webp";
import stockPondImg from "@/assets/projects/stock-pond-excavation.webp";
import stockPondMobileImg from "@/assets/projects/stock-pond-excavation-768.webp";
import crushedConcreteImg from "@/assets/projects/crushed-concrete-delivery.webp";
import crushedConcreteMobileImg from "@/assets/projects/crushed-concrete-delivery-768.webp";
import ranchRoadImg from "@/assets/projects/ranch-road-repair.webp";
import ranchRoadMobileImg from "@/assets/projects/ranch-road-repair-768.webp";
import landClearingImg from "@/assets/projects/land-clearing.webp";
import landClearingMobileImg from "@/assets/projects/land-clearing-768.webp";
import pondDrainageImg from "@/assets/projects/pond-drainage-fix.webp";
import pondDrainageMobileImg from "@/assets/projects/pond-drainage-fix-768.webp";
import gravelParkingImg from "@/assets/projects/gravel-parking-pad.webp";
import gravelParkingMobileImg from "@/assets/projects/gravel-parking-pad-768.webp";

const SMS_HREF = "sms:+12146778466";

const projects = [
  { title: "New Gravel Driveway", category: "Driveways", image: gravelDrivewayImg, mobileImage: gravelDrivewayMobileImg },
  { title: "Stock Pond Excavation", category: "Ponds", image: stockPondImg, mobileImage: stockPondMobileImg },
  { title: "Crushed Concrete Delivery", category: "Delivery", image: crushedConcreteImg, mobileImage: crushedConcreteMobileImg },
  { title: "Ranch Road Repair", category: "Dirt Work", image: ranchRoadImg, mobileImage: ranchRoadMobileImg },
  { title: "Driveway Regrading", category: "Driveways", image: drivewayRegradingImg, mobileImage: drivewayRegradingMobileImg },
  { title: "Pond Drainage Fix", category: "Ponds", image: pondDrainageImg, mobileImage: pondDrainageMobileImg },
  { title: "Mason Sand Delivery", category: "Delivery", image: masonSandDeliveryImg, mobileImage: masonSandDeliveryMobileImg },
  { title: "Light Clearing & Grading", category: "Dirt Work", image: landClearingImg, mobileImage: landClearingMobileImg },
  { title: "Gravel Parking Pad", category: "Driveways", image: gravelParkingImg, mobileImage: gravelParkingMobileImg },
];

const Projects = () => (
  <>
    <Seo
      title="Driveway, Pond & Dirt Work Projects | Kaufman TX"
      description="View recent driveway work, pond excavation, material deliveries, grading and light land clearing near Kaufman, Texas."
      path="/projects"
      ogImage={projectsHeroImg}
      ogImageAlt="Recent driveway, pond and dirt work projects by Monkey Trucking near Kaufman, TX"
    />

    <section className="public-page-hero">
        <ResponsiveImage src={projectsHeroImg} mobileSrc={projectsHeroMobileImg} alt="Completed Monkey Trucking property project" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-nearblack via-nearblack/72 to-nearblack/15" />
        <div className="relative mx-auto w-full max-w-[1380px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-[760px]">
            <h1 className="public-page-title">Our work</h1>
            <p className="public-page-intro">Driveways, ponds, deliveries and dirt work completed around North Texas.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/contact" className="public-button public-button-primary">Request a Quote</Link>
              <a href={SMS_HREF} className="public-button public-button-dark-outline"><MessageSquare className="h-5 w-5" />Text 214-677-8466</a>
            </div>
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
