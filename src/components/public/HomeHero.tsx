import { ArrowDownRight, Phone } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import heroImage from "@/assets/services/aggregate-hauling.webp";

const sequence = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.075, delayChildren: 0.14 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.44, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function HomeHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="public-home-hero" aria-labelledby="home-hero-heading">
      <motion.div className="public-home-hero-media" initial={reduceMotion ? false : { opacity: 0, clipPath: "inset(0 12% 0 0)" }} animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)" }} transition={{ duration: reduceMotion ? 0 : 0.62, ease: [0.16, 1, 0.3, 1] }}>
        <img src={heroImage} alt="Monkey Trucking delivering aggregate to a property" loading="eager" decoding="async" className="h-full w-full object-cover" />
        <div className="public-home-hero-media-shade" />
      </motion.div>

      <motion.div className="public-home-hero-panel" variants={reduceMotion ? undefined : sequence} initial={reduceMotion ? false : "hidden"} animate="visible">
        <motion.h1 id="home-hero-heading" variants={reduceMotion ? undefined : item} className="font-heading text-[clamp(48px,7.4vw,102px)] uppercase leading-[0.84] tracking-[0.005em] text-white">
          <span className="block whitespace-nowrap text-primary">Gravel, Delivery</span>
          <span className="block whitespace-nowrap">&amp; Dirt Work</span>
        </motion.h1>
        <motion.p variants={reduceMotion ? undefined : item} className="mt-6 max-w-[590px] text-lg leading-relaxed text-white/[0.76] sm:text-xl">Materials, driveways, ponds and dirt work across Kaufman and surrounding areas.</motion.p>
        <motion.div variants={reduceMotion ? undefined : item} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="tel:+12146778466" className="public-button public-button-primary"><Phone className="h-5 w-5" />Call 214-677-8466</a>
          <a href="#quote-request" className="public-button public-button-light">Get a Quote<ArrowDownRight className="h-5 w-5" /></a>
        </motion.div>
      </motion.div>
    </section>
  );
}
