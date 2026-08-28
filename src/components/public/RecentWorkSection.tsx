import { useState } from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { recentWorkProjects, type RecentWorkProject } from "@/content/publicHome";
import PublicReveal from "./PublicReveal";

function RecentWorkRow({ project, index, open, onToggle }: { project: RecentWorkProject; index: number; open: boolean; onToggle: () => void }) {
  const reduceMotion = useReducedMotion();
  const imageFirst = index % 2 === 1;

  return (
    <motion.article layout className="border-b border-black/15" transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] }}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`project-detail-${project.id}`} className="group grid w-full grid-cols-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:grid-cols-12">
        <motion.div layout className={`relative min-h-[230px] overflow-hidden bg-[#d8d6d1] sm:min-h-[300px] md:col-span-7 md:min-h-[330px] ${imageFirst ? "md:order-1" : "md:order-2"}`}>
          <motion.img layout src={project.image} alt={project.title} loading="lazy" decoding="async" className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.025] ${open ? "scale-[1.015]" : "scale-100"}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent md:hidden" />
        </motion.div>

        <motion.div layout className={`flex min-h-[230px] flex-col justify-center bg-[#f2f1ee] p-6 sm:min-h-[260px] sm:p-9 md:col-span-5 md:min-h-[330px] lg:p-12 ${imageFirst ? "md:order-2" : "md:order-1"}`}>
          <span className="font-label text-sm font-bold uppercase tracking-[0.12em] text-primary">{project.category}</span>
          <h3 className="mt-3 max-w-[520px] font-heading text-[clamp(38px,5vw,64px)] uppercase leading-[0.9] text-[#171719]">{project.title}</h3>

          {reduceMotion ? open && (
            <div id={`project-detail-${project.id}`}>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#55555c]">{project.description}</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {open && (
              <motion.div id={`project-detail-${project.id}`} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}>
                <p className="mt-5 max-w-lg text-lg leading-relaxed text-[#55555c]">{project.description}</p>
              </motion.div>
              )}
            </AnimatePresence>
          )}

          <span className="mt-7 flex min-h-12 items-center gap-3 font-label text-base font-bold uppercase text-[#171719]">
            <span className="flex h-11 w-11 items-center justify-center border border-black/20 bg-white transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-white" aria-hidden="true">
              {reduceMotion
                ? open ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />
                : <AnimatePresence initial={false} mode="wait">
                    {open ? <motion.span key="minus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Minus className="h-5 w-5" /></motion.span> : <motion.span key="plus" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Plus className="h-5 w-5" /></motion.span>}
                  </AnimatePresence>}
            </span>
            {open ? "Close details" : "View details"}
          </span>
        </motion.div>
      </button>
    </motion.article>
  );
}

export default function RecentWorkSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="bg-[#e7e6e2] py-16 sm:py-20 lg:py-24" aria-labelledby="recent-work-heading">
      <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-12">
        <PublicReveal>
          <h2 id="recent-work-heading" className="font-heading text-[clamp(44px,6vw,76px)] uppercase leading-none text-[#171719]">Recent work</h2>
          <Link to="/projects" className="public-text-link mt-4">View All Projects<ArrowRight className="h-5 w-5" /></Link>
        </PublicReveal>

        <div className="mt-9 border-t border-black/15">
          {recentWorkProjects.map((project, index) => (
            <RecentWorkRow key={project.id} project={project} index={index} open={openId === project.id} onToggle={() => setOpenId((current) => current === project.id ? null : project.id)} />
          ))}
        </div>
      </div>
    </section>
  );
}
