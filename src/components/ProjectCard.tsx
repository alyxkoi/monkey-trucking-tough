import { useState } from "react";
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
        className="group w-full overflow-hidden rounded-lg bg-industrial text-left shadow-sm transition-transform duration-200 motion-reduce:transition-none hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={() => setLightboxOpen(true)}
        aria-label={`View ${title}`}
      >
        <div className="aspect-[4/3] overflow-hidden">
          <img src={image} alt={title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 motion-reduce:transition-none group-hover:scale-[1.025]" />
        </div>
        <div className="min-h-[104px] p-4 sm:p-5">
          <span className="font-label text-sm font-semibold text-primary">{category}</span>
          <h2 className="mt-1 font-heading text-xl uppercase leading-none text-white sm:text-2xl">{title}</h2>
        </div>
      </button>
      <ProjectLightbox image={image} title={title} category={category} isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </>
  );
};

export default ProjectCard;
