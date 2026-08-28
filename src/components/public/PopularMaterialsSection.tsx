import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import VerticalBarsNoise from "@/components/ui/vertical-bars";
import { popularMaterials, type PopularMaterial } from "@/content/publicHome";
import PublicReveal from "./PublicReveal";

const architecturalEase = [0.16, 1, 0.3, 1] as const;

function MaterialPreview({ material, index }: { material: PopularMaterial; index: number }) {
  const [showOutcome, setShowOutcome] = useState(false);
  const reduceMotion = useReducedMotion();
  const hasOutcome = Boolean(material.jobImage);

  return (
    <motion.article
      className={`popular-material-card group ${hasOutcome ? "popular-material-card-outcome" : ""} ${showOutcome ? "is-showing-outcome" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : index * 0.045, ease: architecturalEase }}
    >
      <div className="popular-material-media">
        <img
          src={material.image}
          alt={`${material.name} aggregate material pile`}
          loading="lazy"
          decoding="async"
          className="popular-material-image popular-material-image-default"
        />

        {material.jobImage && (
          <img
            src={material.jobImage}
            alt={material.jobImageAlt ?? `${material.name} in use`}
            loading="lazy"
            decoding="async"
            className="popular-material-image popular-material-image-outcome"
          />
        )}

        {hasOutcome && (
          <button
            type="button"
            onClick={() => setShowOutcome((current) => !current)}
            aria-label={showOutcome ? "View material" : "See in use"}
            aria-pressed={showOutcome}
            className="popular-material-toggle"
          >
            <span>{showOutcome ? "View material" : "See in use"}</span>
            <ArrowRight className={`h-4 w-4 ${showOutcome ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="popular-material-copy">
        <h3>{material.name}</h3>
        <p>{material.use}</p>
      </div>
    </motion.article>
  );
}

export default function PopularMaterialsSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="popular-materials" aria-labelledby="popular-materials-heading">
      <div className="popular-materials-ambient" aria-hidden="true">
        <div className="popular-materials-ambient-frame">
          {reduceMotion ? (
            <div className="absolute inset-0 bg-[#0b0b0d]" />
          ) : (
            <VerticalBarsNoise
              backgroundColor="#0b0b0d"
              lineColor="#5f6064"
              barColor="#d8d9db"
              lineWidth={1}
              animationSpeed={0.0005}
              removeWaveLine
            />
          )}
        </div>
      </div>

      <div className="popular-materials-shade" aria-hidden="true" />

      <div className="popular-materials-container">
        <PublicReveal>
          <header className="popular-materials-header">
            <h2 id="popular-materials-heading">Popular materials</h2>
            <p>A few of our most requested materials for driveways, roads, site work and property projects. Call us for current pricing and delivery.</p>
          </header>
        </PublicReveal>

        <div className="popular-materials-grid">
          {popularMaterials.map((material, index) => (
            <MaterialPreview key={material.id} material={material} index={index} />
          ))}
        </div>

        <PublicReveal className="popular-materials-cta-wrap" delay={0.08}>
          <Link to="/materials" className="popular-materials-cta">
            <span>View All Materials</span>
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </PublicReveal>
      </div>
    </section>
  );
}
