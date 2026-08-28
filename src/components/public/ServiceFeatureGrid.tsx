import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { publicServiceFeatures, type PublicServiceFeature } from "@/content/publicHome";
import PublicReveal from "./PublicReveal";

const placement = [
  "md:col-span-2 lg:col-span-7 lg:row-span-2",
  "lg:col-span-5",
  "lg:col-span-5",
  "md:col-span-2 lg:col-span-12",
];

const imagePosition = ["object-center", "object-center", "object-center", "object-[center_58%]"];

function ServiceCard({ service, index, open, onOpen }: { service: PublicServiceFeature; index: number; open: boolean; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      layoutId={`service-shell-${service.id}`}
      data-service-trigger={service.id}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onOpen}
      className={`group relative min-h-[270px] overflow-hidden bg-[#16161a] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-[#ecebea] md:min-h-[320px] ${placement[index]}`}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.img
        layoutId={`service-image-${service.id}`}
        src={service.image}
        alt={service.title}
        loading={index === 0 ? "eager" : "lazy"}
        decoding="async"
        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.035] ${imagePosition[index]}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#101012] via-[#101012]/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-5 sm:p-7">
        <div className="max-w-xl">
          <motion.h3 layoutId={`service-title-${service.id}`} className="font-heading text-[clamp(30px,4vw,52px)] uppercase leading-[0.92] text-white">
            {service.title}
          </motion.h3>
          <p className="mt-2 max-w-md text-base leading-snug text-white/[0.78] sm:text-lg">{service.summary}</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/35 bg-[#121214]/70 text-white backdrop-blur-sm transition-colors duration-200 group-hover:border-primary group-hover:bg-primary" aria-hidden="true">
          <ArrowRight className="h-5 w-5" />
        </span>
      </div>
    </motion.button>
  );
}

function ExpandedService({ service, onClose }: { service: PublicServiceFeature; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-service-trigger="${service.id}"]`)?.focus();
      });
    };
  }, [onClose, service.id]);

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close service details backdrop"
        tabIndex={-1}
        className="fixed inset-0 z-[70] cursor-default bg-black/[0.78] backdrop-blur-[3px]"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24 }}
        onClick={onClose}
      />
      <motion.section
        layoutId={`service-shell-${service.id}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`expanded-${service.id}`}
        className="fixed inset-x-3 bottom-3 top-[88px] z-[80] m-auto grid max-w-[1180px] overflow-y-auto bg-[#151518] text-white shadow-[0_36px_100px_rgba(0,0,0,0.62)] md:inset-x-8 md:bottom-8 lg:grid-cols-[1.12fr_0.88fr] lg:overflow-hidden"
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 30, mass: 0.9 }}
      >
        <div className="relative min-h-[270px] overflow-hidden md:min-h-[360px] lg:min-h-0">
          <motion.img layoutId={`service-image-${service.id}`} src={service.image} alt={service.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#151518]/80 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#151518]/25" />
          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-2 sm:bottom-6 sm:left-6 sm:right-6">
            {service.supportingImages.map((image, index) => (
              <img key={image} src={image} alt={`${service.title} example ${index + 1}`} loading="lazy" decoding="async" className="aspect-[16/10] w-full border border-white/15 object-cover" />
            ))}
          </div>
        </div>

        <div className="relative flex flex-col justify-center p-6 sm:p-9 lg:p-12">
          <button ref={closeRef} type="button" onClick={onClose} className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center border border-white/20 bg-white/5 text-white transition-colors hover:border-primary hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Close service details">
            <X className="h-6 w-6" />
          </button>
          <motion.h2 layoutId={`service-title-${service.id}`} id={`expanded-${service.id}`} className="max-w-[620px] pr-12 font-heading text-[clamp(42px,6vw,74px)] uppercase leading-[0.9] text-white">
            {service.title}
          </motion.h2>
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.18, duration: 0.35 }}>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/[0.76]">{service.description}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2" aria-label={`${service.title} capabilities`}>
              {service.capabilities.map((capability) => (
                <li key={capability} className="border-l-2 border-primary pl-3 font-label text-base font-semibold text-white/[0.88]">{capability}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={service.to} className="public-button public-button-light">View Service<ArrowRight className="h-5 w-5" /></Link>
              <Link to="/contact" className="public-button public-button-primary">Get a Quote</Link>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </>
  );
}

export default function ServiceFeatureGrid() {
  const [selected, setSelected] = useState<PublicServiceFeature | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <LayoutGroup>
      <section className="bg-[#ecebea] py-16 sm:py-20 lg:py-24" aria-labelledby="service-feature-heading">
        <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
          <PublicReveal>
            <h2 id="service-feature-heading" className="font-heading text-[clamp(44px,6vw,76px)] uppercase leading-none text-[#171719]">What do you need?</h2>
            <p className="mt-4 max-w-[620px] text-lg leading-relaxed text-[#56565d]">Choose a service to see the work we can help with.</p>
          </PublicReveal>
          <div className="mt-9 grid grid-cols-1 gap-3 md:grid-cols-2 md:auto-rows-[300px] lg:grid-cols-12 lg:auto-rows-[245px] lg:gap-4">
            {publicServiceFeatures.map((service, index) => (
              <ServiceCard key={service.id} service={service} index={index} open={selected?.id === service.id} onOpen={() => setSelected(service)} />
            ))}
          </div>
        </div>
      </section>

      {reduceMotion
        ? selected && <ExpandedService key={selected.id} service={selected} onClose={() => setSelected(null)} />
        : <AnimatePresence>{selected && <ExpandedService key={selected.id} service={selected} onClose={() => setSelected(null)} />}</AnimatePresence>}
    </LayoutGroup>
  );
}
