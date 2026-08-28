import { ArrowUpRight, Phone } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/services/aggregate-hauling.webp";

export const HERO_VIDEO_URL = "https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/videos//job home hero.mp4";

const sequence = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.46,
      ease: [0.16, 1, 0.3, 1] as const,
      staggerChildren: 0.065,
      delayChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.44, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function HomeHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="public-home-hero" aria-labelledby="home-hero-heading">
      <motion.div className="public-home-hero-media" initial={reduceMotion ? false : { opacity: 0, scale: 1.015 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduceMotion ? 0 : 0.56, ease: [0.16, 1, 0.3, 1] }}>
        <img className="public-home-hero-poster" src={heroImage} alt="Monkey Trucking material delivery job" loading="eager" decoding="async" />
        {!reduceMotion && (
          <video autoPlay loop muted playsInline preload="metadata" poster={heroImage} aria-hidden="true" tabIndex={-1}>
            <source src={HERO_VIDEO_URL} type="video/mp4" />
          </video>
        )}
        <div className="public-home-hero-media-shade" />
      </motion.div>

      <motion.div className="public-home-hero-panel" variants={reduceMotion ? undefined : sequence} initial={reduceMotion ? false : "hidden"} animate="visible">
        <motion.h1 id="home-hero-heading" variants={reduceMotion ? undefined : item} className="public-home-hero-title font-display uppercase text-white">
          <span className="block text-primary">Material Delivery</span>
          <span className="block">Driveway Installation</span>
          <span className="block">Dirt &amp; Site Work</span>
        </motion.h1>
        <motion.p variants={reduceMotion ? undefined : item} className="public-home-hero-location">Based in Kaufman, Texas. Serving properties across DFW.</motion.p>
        <motion.div variants={reduceMotion ? undefined : item} className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href="tel:+12146778466" className="public-button public-hero-cta public-hero-cta-primary"><Phone className="h-5 w-5" />Call 214-677-8466</a>
          <Link to="/contact" className="public-button public-hero-cta public-hero-cta-secondary">Get a Quote<ArrowUpRight className="h-5 w-5" /></Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
