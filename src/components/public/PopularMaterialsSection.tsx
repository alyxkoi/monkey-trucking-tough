import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { popularMaterials, type PopularMaterial } from "@/content/publicHome";
import PublicReveal from "./PublicReveal";
import VerticalBarsNoise from "./VerticalBarsNoise";

const placement = [
  "md:col-span-2 lg:col-span-5",
  "lg:col-span-4",
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-4",
  "md:col-span-2 lg:col-span-5",
];

function MaterialPreview({ material, index }: { material: PopularMaterial; index: number }) {
  const [showOutcome, setShowOutcome] = useState(false);
  const reduceMotion = useReducedMotion();
  const hasOutcome = Boolean(material.jobImage);

  return (
    <motion.article
      className={`group relative overflow-hidden border border-white/10 bg-[#17171a] ${placement[index]}`}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.4, delay: index * 0.055, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-[#202024] sm:aspect-[16/11] lg:aspect-[16/10]">
        <img src={material.image} alt={`${material.name} aggregate sample`} loading="lazy" decoding="async" className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ease-out motion-reduce:transition-none ${showOutcome && hasOutcome ? "scale-[1.03] opacity-0" : "opacity-100 group-hover:scale-[1.025]"} ${hasOutcome ? "lg:group-hover:opacity-0" : ""}`} />
        {material.jobImage && (
          <img src={material.jobImage} alt={material.jobImageAlt ?? `${material.name} in use`} loading="lazy" decoding="async" className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ease-out motion-reduce:transition-none ${showOutcome ? "scale-100 opacity-100" : "scale-[1.035] opacity-0 lg:group-hover:scale-100 lg:group-hover:opacity-100"}`} />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#17171a] to-transparent" />
      </div>
      <div className="relative min-h-[150px] p-4 sm:min-h-[144px] sm:p-5">
        <h3 className="font-label text-[17px] font-bold leading-tight text-white sm:text-xl">{material.name}</h3>
        <p className="mt-2 text-[15px] leading-snug text-white/[0.62] sm:text-base">{material.use}</p>
        {hasOutcome && (
          <button type="button" onClick={() => setShowOutcome((current) => !current)} aria-pressed={showOutcome} className="mt-4 flex min-h-11 items-center gap-2 font-label text-sm font-bold uppercase text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden">
            {showOutcome ? "View material" : "See in use"}<ArrowRight className={`h-4 w-4 transition-transform ${showOutcome ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </motion.article>
  );
}

export default function PopularMaterialsSection() {
  return (
    <section className="relative isolate overflow-hidden bg-[#101012] py-16 text-white sm:py-20 lg:py-24" aria-labelledby="popular-materials-heading">
      <VerticalBarsNoise removeWaveLine animationSpeed={0.22} lineColor="rgba(241, 239, 234, 0.12)" barColor="rgba(241, 239, 234, 0.065)" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#101012]/30 via-transparent to-[#101012]/60" aria-hidden="true" />
      <div className="relative mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <PublicReveal>
          <h2 id="popular-materials-heading" className="font-heading text-[clamp(44px,6vw,76px)] uppercase leading-none text-white">Popular materials</h2>
          <p className="mt-4 max-w-[600px] text-lg leading-relaxed text-white/[0.68]">Common driveway, base, sand and landscaping materials. Call for current pricing.</p>
        </PublicReveal>

        <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-12 lg:gap-4">
          {popularMaterials.map((material, index) => <MaterialPreview key={material.id} material={material} index={index} />)}
        </div>

        <PublicReveal className="mt-8" delay={0.08}>
          <Link to="/materials" className="public-button public-button-light">View All Materials<ArrowRight className="h-5 w-5" /></Link>
        </PublicReveal>
      </div>
    </section>
  );
}
