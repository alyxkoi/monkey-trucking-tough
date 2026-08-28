import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import ProjectLightbox from "./ProjectLightbox";
import ResponsiveImage from "@/components/public/ResponsiveImage";

interface ProjectCardProps {
  title: string;
  category: string;
  image: string;
  mobileImage: string;
}

const ProjectCard = ({ title, category, image, mobileImage }: ProjectCardProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="public-project-card group"
        onClick={() => setLightboxOpen(true)}
        aria-label={`View ${title}`}
      >
        <div className="public-project-card-media">
          <ResponsiveImage src={image} mobileSrc={mobileImage} alt={title} loading="lazy" decoding="async" />
        </div>
        <div className="public-project-card-copy">
          <span>{category}</span>
          <div className="public-project-card-title-row">
            <h2>{title}</h2>
            <ArrowUpRight aria-hidden="true" />
          </div>
        </div>
      </button>
      <ProjectLightbox image={image} title={title} category={category} isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  );
};

export default ProjectCard;
