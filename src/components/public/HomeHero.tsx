import { ArrowUpRight, Phone } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export const HERO_VIDEO_URL = "https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/videos//job home hero.mp4";
export const DESKTOP_HERO_VIDEO_URL = "https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/videos//job1 cropped 3x2.mp4";

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

const DESKTOP_QUERY = "(min-width: 1200px)";

export default function HomeHero() {
  const reduceMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };
    setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
    };
  }, []);

  const videoSrc = isDesktop ? DESKTOP_HERO_VIDEO_URL : HERO_VIDEO_URL;

  return (
    <section className="public-home-hero" aria-labelledby="home-hero-heading">
      <div className="public-home-hero-media">
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay={!reduceMotion}
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="public-home-hero-media-shade" />
      </div>


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
