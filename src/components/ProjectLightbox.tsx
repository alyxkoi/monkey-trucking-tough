import { useEffect } from "react";
import { X } from "lucide-react";

interface ProjectLightboxProps {
  image: string;
  title: string;
  category: string;
  isOpen: boolean;
  onClose: () => void;
}

const ProjectLightbox = ({ image, title, category, isOpen, onClose }: ProjectLightboxProps) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 cursor-pointer"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm animate-[fade-in_300ms_ease-out]" />

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close project preview"
        className="absolute top-4 right-4 z-10 text-white/70 hover:text-white transition-colors duration-200 p-2 rounded-full hover:bg-white/10 active:scale-95"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Image container */}
      <div
        className="relative z-10 max-w-4xl w-full max-h-[85vh] rounded-lg overflow-hidden shadow-2xl cursor-default animate-[lightbox-in_400ms_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image}
          alt={title}
          className="w-full h-auto max-h-[75vh] object-contain bg-black"
        />
        <div className="bg-industrial p-4">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">{category}</span>
          <h3 className="font-heading text-h4 text-white mt-1">{title}</h3>
        </div>
      </div>
    </div>
  );
};

export default ProjectLightbox;
