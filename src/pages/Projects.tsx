import { Phone } from "lucide-react";
import Seo from "@/components/Seo";
import ContactActionSheet from "@/components/ContactActionSheet";
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
import { Button } from "@/components/ui/button";
import ProjectCard from "@/components/ProjectCard";
import CTASection from "@/components/CTASection";

const projects = [
  { title: "New Gravel Driveway", category: "Driveways", bgColor: "linear-gradient(135deg, #5C5650, #8B8680)", image: gravelDrivewayImg },
  { title: "Stock Pond Excavation", category: "Ponds", bgColor: "linear-gradient(135deg, #4A6741, #6B8F62)", image: stockPondImg },
  { title: "Crushed Concrete Delivery", category: "Delivery", bgColor: "linear-gradient(135deg, #7A7A7A, #9E9E9E)", image: crushedConcreteImg },
  { title: "Ranch Road Repair", category: "Dirt Work", bgColor: "linear-gradient(135deg, #8B6914, #B8960F)", image: ranchRoadImg },
  { title: "Driveway Regrading", category: "Driveways", bgColor: "linear-gradient(135deg, #6B5B4F, #9E8E80)", image: drivewayRegradingImg },
  { title: "Pond Drainage Fix", category: "Drainage", bgColor: "linear-gradient(135deg, #4A5568, #718096)", image: pondDrainageImg },
  { title: "Mason Sand Delivery", category: "Delivery", bgColor: "linear-gradient(135deg, #A09070, #C4B59A)", image: masonSandDeliveryImg },
  { title: "Land Clearing & Grading", category: "Dirt Work", bgColor: "linear-gradient(135deg, #6B4226, #8B6240)", image: landClearingImg },
  { title: "Gravel Parking Pad", category: "Driveways", bgColor: "linear-gradient(135deg, #8B8680, #A09B94)", image: gravelParkingImg },
];

const Projects = () => {
  return (
    <>
      <Seo
        title="Gravel Driveway & Pond Construction Projects Near Kaufman, TX"
        description="Recent gravel driveway installations, pond construction, ranch road repairs, and crushed concrete deliveries near Kaufman, TX."
        path="/projects"
      />
      {/* Hero */}
      <section className="relative bg-industrial py-20 md:py-28 overflow-hidden">
        <img src={projectsHeroImg} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-105 opacity-30" />
        <div className="relative container mx-auto px-4">
          <h1 className="font-heading text-h1 text-white mb-4">OUR WORK</h1>
          <p className="text-body text-white/80 max-w-2xl mb-8">
            Browse examples of completed hauling, driveway installs, pond construction, and dirt work projects across Kaufman County and surrounding areas.
          </p>
          <ContactActionSheet>
            {({ onClick }) => (
              <Button onClick={onClick} className="bg-primary text-primary-foreground hover:bg-primary/85 font-heading text-h4 tracking-wider px-8 h-14 min-h-[48px] transition-transform hover:-translate-y-0.5">
                <Phone className="mr-2 h-5 w-5" />
                CALL OR TEXT FOR QUOTE
              </Button>
            )}
          </ContactActionSheet>
        </div>
      </section>

      {/* Project Gallery */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-h2 text-foreground text-center mb-12">PROJECT GALLERY</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.title} {...project} />
            ))}
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="py-16 md:py-20 bg-light-gray">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-h1 text-primary text-center mb-12">RECENT JOBS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto">
            {/* Before */}
            <div>
              <div
                className="relative w-full rounded-sm border-2 border-border shadow-lg overflow-hidden"
                style={{ aspectRatio: "9 / 16", background: "linear-gradient(135deg, #5C4A3A, #8B7A6A)" }}
              >
                <video
                  src="https://ssuciilipipwlakpwhim.supabase.co/storage/v1/object/public/videos/job1.mp4"
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
              <p className="font-heading text-h4 text-foreground text-center mt-3">FLOODED DRIVEWAY REPAIR</p>
            </div>

            {/* After */}
            <div>
              <div
                className="relative w-full rounded-sm border-2 border-border shadow-lg overflow-hidden"
                style={{ aspectRatio: "9 / 16", background: "linear-gradient(135deg, #8B8680, #C4BDB4)" }}
              >
                <video
                  src="https://ssuciilipipwlakpwhim.supabase.co/storage/v1/object/public/videos/job2.mp4"
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
              <p className="font-heading text-h4 text-foreground text-center mt-3">GRAVEL DRIVEWAY</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <CTASection
        headline="READY TO START YOUR PROJECT?"
        subtext="Call or text Monkey Trucking for a free quote."
      />
    </>
  );
};

export default Projects;
