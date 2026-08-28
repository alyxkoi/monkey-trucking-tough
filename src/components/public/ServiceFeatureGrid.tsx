import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { publicServiceFeatures, type PublicServiceFeature } from "@/content/publicHome";
import PublicReveal from "./PublicReveal";

const placement = [
  "md:col-span-2 xl:col-span-1 xl:row-span-2",
  "xl:col-span-2",
  "",
  "md:col-span-2 xl:col-span-1",
];

const cardHeight = [
  "h-[360px] sm:h-[420px] md:h-[420px] xl:h-auto",
  "h-[300px] md:h-[320px] xl:h-auto",
  "h-[280px] md:h-[320px] xl:h-auto",
  "h-[300px] md:h-[330px] xl:h-auto",
];

const collapsedImagePosition: Record<string, string> = {
  "materials-delivery": "object-[68%_56%]",
  "driveways-roads": "object-[center_62%]",
  ponds: "object-[center_56%]",
  "dirt-work": "object-[center_54%]",
};

const expandedImageTreatment: Record<string, string> = {
  "materials-delivery": "object-cover object-[64%_56%]",
  "driveways-roads": "object-contain object-center",
  ponds: "object-cover object-center",
  "dirt-work": "object-cover object-center",
};

function ServiceCard({
  service,
  index,
  open,
  onOpen,
}: {
  service: PublicServiceFeature;
  index: number;
  open: boolean;
  onOpen: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      layoutId={reduceMotion ? undefined : `service-shell-${service.id}`}
      data-service-trigger={service.id}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={onOpen}
      className={`public-service-card group relative min-w-0 overflow-hidden bg-[#16161a] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-[#f0efec] ${placement[index]} ${cardHeight[index]}`}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      whileTap={reduceMotion ? undefined : { scale: 0.992 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <img
        src={service.image}
        alt={service.title}
        loading={index === 0 ? "eager" : "lazy"}
        decoding="async"
        width="1400"
        height="900"
        className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.025] ${collapsedImagePosition[service.id]}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#101012] via-[#101012]/35 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-5 sm:p-7">
        <div className="min-w-0 max-w-xl">
          <h3 className="font-heading text-[clamp(30px,4vw,52px)] uppercase leading-[0.92] text-white">
            {service.title}
          </h3>
          <p className="mt-2 max-w-md text-base leading-snug text-white/[0.8] sm:text-lg">{service.summary}</p>
        </div>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-white/35 bg-[#121214]/75 text-white backdrop-blur-sm transition-colors duration-200 group-hover:border-primary group-hover:bg-primary" aria-hidden="true">
          <ArrowRight className="h-5 w-5" />
        </span>
      </div>
    </motion.button>
  );
}

function ExpandedService({ service, onClose }: { service: PublicServiceFeature; onClose: () => void }) {
  const surfaceRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !surfaceRef.current) return;
      const focusable = Array.from(
        surfaceRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-service-trigger="${service.id}"]`)?.focus({ preventScroll: true });
      });
    };
  }, [onClose, service.id]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 pt-[88px] sm:p-6 sm:pt-[96px] lg:p-10 lg:pt-[104px]">
      <motion.button
        type="button"
        aria-label="Close service details backdrop"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-[#111114]/65 backdrop-blur-[2px]"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        onClick={onClose}
      />

      <motion.section
        ref={surfaceRef}
        layoutId={reduceMotion ? undefined : `service-shell-${service.id}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`expanded-${service.id}`}
        aria-describedby={`expanded-description-${service.id}`}
        className="public-service-detail relative z-[1] flex max-h-[calc(100dvh-112px)] w-full max-w-[1120px] flex-col overflow-y-auto bg-[#17171a] text-white shadow-[0_32px_100px_rgba(22,22,26,0.48)] lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:overflow-hidden"
        transition={reduceMotion ? { duration: 0 } : { layout: { duration: 0.36, ease: [0.16, 1, 0.3, 1] } }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center border border-white/30 bg-[#17171a]/88 text-white backdrop-blur-sm transition-colors duration-200 hover:border-primary hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:right-6 sm:top-6"
          aria-label="Close service details"
        >
          <X className="h-6 w-6" />
        </button>

        <motion.div
          className="relative aspect-[4/3] min-h-0 overflow-hidden bg-[#0f0f11] lg:aspect-auto lg:min-h-[570px]"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.08 }}
        >
          <img
            src={service.image}
            alt={`${service.title} project`}
            width="1400"
            height="900"
            className={`absolute inset-0 h-full w-full ${expandedImageTreatment[service.id]}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#17171a]/28 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#17171a]/18" />
        </motion.div>

        <div className="relative flex flex-col justify-center p-6 sm:p-9 lg:p-11">
          <h2 id={`expanded-${service.id}`} className="max-w-[620px] pr-14 font-heading text-[clamp(40px,5vw,68px)] uppercase leading-[0.92] text-white">
            {service.title}
          </h2>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ delay: reduceMotion ? 0 : 0.14, duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <p id={`expanded-description-${service.id}`} className="mt-5 max-w-xl text-base leading-relaxed text-white/[0.78] sm:text-lg">{service.description}</p>
            <ul className="mt-6 grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2" aria-label={`${service.title} capabilities`}>
              {service.capabilities.map((capability) => (
                <li key={capability} className="border-l-2 border-primary pl-3 font-label text-base font-semibold text-white/[0.9]">{capability}</li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={service.to} className="public-button public-button-light">View Service<ArrowRight className="h-5 w-5" /></Link>
              <Link to="/contact" className="public-button public-button-primary">Get a Quote</Link>
            </div>
          </motion.div>
        </div>
      </motion.section>
    </div>,
    document.body,
  );
}

export default function ServiceFeatureGrid() {
  const [selected, setSelected] = useState<PublicServiceFeature | null>(null);

  return (
    <LayoutGroup id="public-service-features">
      <section className="public-service-feature-section w-full py-16 sm:py-20 lg:py-24" aria-labelledby="service-feature-heading">
        <div className="mx-auto max-w-[1560px] px-5 sm:px-8 lg:px-12">
          <PublicReveal>
            <h2 id="service-feature-heading" className="font-display text-[clamp(46px,6vw,78px)] uppercase leading-[0.94] text-primary">Here&apos;s What We Do.</h2>
            <p className="mt-5 max-w-[720px] text-base leading-relaxed text-[#29292d] sm:text-lg">
              From material delivery to driveways, ponds and site work, choose what you need to see how we can help.
            </p>
          </PublicReveal>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-[minmax(0,6.5fr)_minmax(240px,2.5fr)_minmax(280px,3fr)] xl:grid-rows-[292px_292px] xl:gap-5">
            {publicServiceFeatures.map((service, index) => (
              <ServiceCard
                key={service.id}
                service={service}
                index={index}
                open={selected?.id === service.id}
                onOpen={() => setSelected((current) => current?.id === service.id ? null : service)}
              />
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence initial={false} mode="wait">
        {selected && (
          <ExpandedService
            key={selected.id}
            service={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
