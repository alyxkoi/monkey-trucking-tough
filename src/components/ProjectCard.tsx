import { useState } from "react";
import ProjectLightbox from "./ProjectLightbox";

interface ProjectCardProps {
  title: string;
  category: string;
  bgColor: string;
  image?: string;
}

const ProjectCard = ({ title, category, bgColor, image }: ProjectCardProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div
        className="relative rounded-lg overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.97]"
        onClick={() => image && setLightboxOpen(true)}
      >
        <div
          className="h-64 flex items-end"
          style={{ background: bgColor }}
        >
          {image && (
            <img src={image} alt={title} className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-industrial/60 to-transparent" />
          <div className="relative p-5">
            <span className="text-small text-primary font-semibold uppercase tracking-wider">{category}</span>
            <h3 className="font-heading text-h4 text-industrial-foreground mt-1">{title}</h3>
          </div>
        </div>
      </div>
      {image && (
        <ProjectLightbox
          image={image}
          title={title}
          category={category}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
};

export default ProjectCard;
