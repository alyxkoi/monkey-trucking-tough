import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type PublicRevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  blur?: boolean;
  blurAmount?: number;
  distance?: number;
  duration?: number;
  scale?: number;
};

export default function PublicReveal({
  children,
  className = "",
  delay = 0,
  blur = false,
  blurAmount = 8,
  distance = 20,
  duration = 0.42,
  scale = 1,
}: PublicRevealProps) {
  const reduceMotion = useReducedMotion();
  const initial = {
    opacity: 0,
    y: distance,
    ...(blur ? { filter: `blur(${blurAmount}px)` } : {}),
    ...(scale !== 1 ? { scale } : {}),
  };
  const visible = {
    opacity: 1,
    y: 0,
    ...(blur ? { filter: "blur(0px)" } : {}),
    ...(scale !== 1 ? { scale: 1 } : {}),
  };

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : initial}
      whileInView={visible}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
