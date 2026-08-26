import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";

interface MaterialCardProps {
  name: string;
  description: string;
  uses: string;
  sizes?: string;
  colorFrom?: string;
  colorTo?: string;
  image?: string;
  tint?: string;
  projectImage?: string;
}

const MaterialCard = ({ name, description, uses, sizes, image, tint = "hsl(0 0% 96%)", projectImage }: MaterialCardProps) => {
  const [open, setOpen] = useState(false);
  const preloaded = useRef(false);

  // Preload zoom image on first hover so it's cached before click
  const handlePointerEnter = useCallback(() => {
    if (preloaded.current || !projectImage) return;
    preloaded.current = true;
    const img = new Image();
    img.src = projectImage;
  }, [projectImage]);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <>
      {/* Prefetch link for the zoom image */}
      {projectImage && (
        <link rel="prefetch" href={projectImage} as="image" />
      )}

      <div
        className="cursor-pointer rounded-lg overflow-hidden border border-border transition-shadow duration-200 hover:shadow-xl hover:-translate-y-0.5 group"
        onClick={handleOpen}
        onPointerEnter={handlePointerEnter}
      >
        <div className="relative h-56 flex items-end justify-center material-card" style={{ backgroundColor: tint }}>
          <span className="absolute top-3 right-3 font-heading text-[14px] tracking-wider z-10 rotate-[20deg] text-primary font-semibold">
            click me!
          </span>
          {image && (
            <img src={image} alt={`${name.toLowerCase()} aggregate sample`} loading="lazy" decoding="async" className="w-[95%] max-h-[14rem] object-contain object-bottom absolute bottom-0 left-1/2 -translate-x-1/2 drop-shadow-sm" />
          )}
        </div>
        <div className="h-[3px] bg-gradient-to-r from-transparent via-border to-transparent mx-3" />
        <div className="px-5 pt-4 pb-5 relative bg-white">
          <div className="absolute left-0 top-4 w-1 h-7 rounded-r-sm bg-primary" />
          <h3 className="font-heading text-h4 text-foreground mb-2 pl-3 transition-colors duration-200 group-hover:text-primary">{name}</h3>
          <p className="text-body text-muted-foreground mb-3">{description}</p>
          {sizes && (
            <p className="text-small text-gravel mb-2">
              <span className="font-semibold text-foreground">Available sizes:</span> {sizes}
            </p>
          )}
          <p className="text-small text-gravel">
            <span className="font-semibold text-foreground">Common uses:</span> {uses}
          </p>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-[fadeIn_150ms_ease-out]" onClick={handleClose}>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div
            className="relative rounded-lg overflow-hidden shadow-2xl animate-[scaleIn_200ms_cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: "min(90vw, 600px)", height: "min(80vh, 600px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {projectImage ? (
              <img src={projectImage} alt={`${name} project`} fetchPriority="high" decoding="sync" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 bg-industrial" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
              <h3 className="font-heading text-h3 text-white drop-shadow-md">{name}</h3>
            </div>
            <button
              aria-label={`Close ${name} preview`}
              className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors duration-150"
              onClick={handleClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MaterialCard;
