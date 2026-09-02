import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type PublicRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  blur?: boolean;
};

export default function PublicReveal({ children, className = "", delay = 0, blur = false }: PublicRevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : blur ? { opacity: 0, y: 12, filter: "blur(8px)" } : { opacity: 0, y: 20 }}
      whileInView={blur ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
