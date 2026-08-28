import { useState } from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { recentWorkProjects, type RecentWorkProject } from "@/content/publicHome";
import PublicReveal from "./PublicReveal";

const architecturalEase = [0.16, 1, 0.3, 1] as const;

function RecentWorkRow({ project, index, open, onToggle }: { project: RecentWorkProject; index: number; open: boolean; onToggle: () => void }) {
  const reduceMotion = useReducedMotion();
  const imageFirst = index % 2 === 1;

  return (
    <motion.article
      layout={reduceMotion ? false : "position"}
      className={`public-recent-work-row ${imageFirst ? "public-recent-work-row-reverse" : ""}`}
      transition={{ duration: reduceMotion ? 0 : 0.44, ease: architecturalEase }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`project-detail-${project.id}`}
        className="public-recent-work-trigger group"
      >
        <div className="public-recent-work-image">
          <img
            src={project.image}
            alt={project.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.018] motion-reduce:transition-none"
          />
        </div>

        <div className="public-recent-work-panel">
          <div className="public-recent-work-copy">
            <span className="public-recent-work-category">{project.category}</span>
            <h3 className="public-recent-work-title">{project.title}</h3>

            {reduceMotion ? open && (
              <div id={`project-detail-${project.id}`} className="public-recent-work-detail">
                <p>{project.description}</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={`project-detail-${project.id}`}
                    className="public-recent-work-detail overflow-hidden"
                    initial={{ height: 0, opacity: 0, y: 6 }}
                    animate={{ height: "auto", opacity: 1, y: 0 }}
                    exit={{ height: 0, opacity: 0, y: -4 }}
                    transition={{
                      height: { duration: 0.44, ease: architecturalEase },
                      opacity: { duration: 0.24, ease: "easeOut" },
                      y: { duration: 0.3, ease: architecturalEase },
                    }}
                  >
                    <p>{project.description}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            <span className="public-recent-work-control">
              <span className="public-recent-work-control-box" aria-hidden="true">
                {open ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </span>
              {open ? "Close details" : "View details"}
            </span>
          </div>
        </div>
      </button>
    </motion.article>
  );
}

export default function RecentWorkSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="public-recent-work" aria-labelledby="recent-work-heading">
      <div className="public-recent-work-container">
        <PublicReveal>
          <div className="public-recent-work-header">
            <h2 id="recent-work-heading" className="public-recent-work-heading">Recent work</h2>
            <p className="public-recent-work-intro">A look at recent driveways, pond work, deliveries and property projects completed by our crew.</p>
            <Link to="/projects" className="public-recent-work-all">View All Projects<ArrowRight className="h-5 w-5" /></Link>
          </div>
        </PublicReveal>

        <LayoutGroup id="recent-work-projects">
          <div className="public-recent-work-list">
            {recentWorkProjects.map((project, index) => (
              <RecentWorkRow
                key={project.id}
                project={project}
                index={index}
                open={openId === project.id}
                onToggle={() => setOpenId((current) => current === project.id ? null : project.id)}
              />
            ))}
          </div>
        </LayoutGroup>
      </div>
    </section>
  );
}
