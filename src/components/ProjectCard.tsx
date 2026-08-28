import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import ProjectLightbox from "./ProjectLightbox";

interface ProjectCardProps {
  title: string;
  category: string;
  image: string;
}

const ProjectCard = ({ title, category, image }: ProjectCardProps) => {
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
          <img src={image} alt={title} loading="lazy" decoding="async" />
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
