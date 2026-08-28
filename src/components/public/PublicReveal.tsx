import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type PublicRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export default function PublicReveal({ children, className = "", delay = 0 }: PublicRevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
