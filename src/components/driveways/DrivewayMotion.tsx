import { useEffect, useRef, useState } from "react";
import { CalendarDays, ShieldCheck, Star } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";

const MOTION_EASE = [0.16, 1, 0.3, 1] as const;

function useTypedCharacters(text: string, active: boolean, duration: number, reduceMotion: boolean) {
  const [characterCount, setCharacterCount] = useState(reduceMotion ? text.length : 0);
  const started = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      setCharacterCount(text.length);
      return;
    }
    if (!active || started.current) return;

    started.current = true;
    const startedAt = performance.now();
    let frame = 0;

    const type = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setCharacterCount(Math.min(text.length, Math.floor(progress * (text.length + 1))));
      if (progress < 1) frame = window.requestAnimationFrame(type);
    };

    frame = window.requestAnimationFrame(type);
    return () => window.cancelAnimationFrame(frame);
  }, [active, duration, reduceMotion, text]);

  return {
    complete: characterCount >= text.length,
    text: text.slice(0, characterCount),
  };
}

function TypeCursor() {
  return <span className="driveway-type-cursor" aria-hidden="true" />;
}

export function DrivewayHeroHeadline() {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const heroInView = useInView(headingRef, { amount: 0.35 });
  const [documentVisible, setDocumentVisible] = useState(() => document.visibilityState !== "hidden");
  const [flashCycle, setFlashCycle] = useState(0);
  const firstLine = "Fix it before";
  const secondLine = "the next storm.";
  const combined = `${firstLine}${secondLine}`;
  const typed = useTypedCharacters(combined, true, 1300, reduceMotion);
  const firstLineText = typed.text.slice(0, firstLine.length);
  const secondLineText = typed.text.slice(firstLine.length);
  const cursorOnFirstLine = !typed.complete && firstLineText.length < firstLine.length;

  useEffect(() => {
    const handleVisibility = () => setDocumentVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (reduceMotion || !typed.complete || !heroInView || !documentVisible) return;

    const initialFlash = window.setTimeout(() => setFlashCycle((cycle) => cycle + 1), 140);
    const flashInterval = window.setInterval(() => setFlashCycle((cycle) => cycle + 1), 10_000);
    return () => {
      window.clearTimeout(initialFlash);
      window.clearInterval(flashInterval);
    };
  }, [documentVisible, heroInView, reduceMotion, typed.complete]);

  return (
    <h1 ref={headingRef} id="driveway-hero-title" className="font-display" aria-label="Fix it before the next storm.">
      <span className="driveway-typed-line" data-text={firstLine} aria-hidden="true">
        <span className="driveway-typed-visible">
          {firstLineText}
          {cursorOnFirstLine ? <TypeCursor /> : null}
        </span>
      </span>
      <span className="driveway-typed-line driveway-native-headline-accent" data-text={secondLine} aria-hidden="true">
        <motion.span
          key={flashCycle}
          className="driveway-typed-visible"
          animate={flashCycle > 0 ? {
            filter: ["brightness(1) contrast(1) blur(0px)", "brightness(1.2) contrast(1.08) blur(0.35px)", "brightness(0.96) contrast(1.02) blur(0px)", "brightness(1.1) contrast(1.05) blur(0.2px)", "brightness(1) contrast(1) blur(0px)"],
            textShadow: ["0 0 0 rgba(255,49,49,0)", "0 0 18px rgba(255,244,235,0.3)", "0 0 4px rgba(255,49,49,0.15)", "0 0 12px rgba(255,49,49,0.24)", "0 0 0 rgba(255,49,49,0)"],
          } : undefined}
          transition={{ duration: 0.56, times: [0, 0.12, 0.3, 0.54, 1], ease: "easeOut" }}
        >
          {secondLineText}
          {!typed.complete && !cursorOnFirstLine ? <TypeCursor /> : null}
        </motion.span>
      </span>
    </h1>
  );
}

export function DrivewayResultsHeadline() {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const inView = useInView(headingRef, { once: true, amount: 0.45 });
  const heading = "Real driveway work.";
  const typed = useTypedCharacters(heading, inView, 950, reduceMotion);

  return (
    <h2 ref={headingRef} id="driveway-results-title" className="font-display" aria-label={heading}>
      <span className="driveway-typed-line" data-text={heading} aria-hidden="true">
        <span className="driveway-typed-visible">
          {typed.text}
          {!typed.complete ? <TypeCursor /> : null}
        </span>
      </span>
    </h2>
  );
}

function useCountUp(end: number, start: number, duration: number, active: boolean, reduceMotion: boolean) {
  const [value, setValue] = useState(reduceMotion ? end : start);
  const started = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      setValue(end);
      return;
    }
    if (!active || started.current) return;

    started.current = true;
    const startedAt = performance.now();
    let frame = 0;
    let latestValue = start;

    const count = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(start + (end - start) * eased);
      if (nextValue !== latestValue) {
        latestValue = nextValue;
        setValue(nextValue);
      }
      if (progress < 1) frame = window.requestAnimationFrame(count);
    };

    frame = window.requestAnimationFrame(count);
    return () => window.cancelAnimationFrame(frame);
  }, [active, duration, end, reduceMotion, start]);

  return value;
}

export function DrivewayTrustStats() {
  const railRef = useRef<HTMLElement | null>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const inView = useInView(railRef, { once: true, amount: 0.35 });
  const jobs = useCountUp(150, 0, 1500, inView, reduceMotion);
  const years = useCountUp(12, 1, 1200, inView, reduceMotion);
  const visible = reduceMotion || inView;

  return (
    <aside ref={railRef} className="driveway-form-trust" aria-label="Driveway quote trust signals">
      <motion.div
        className="driveway-form-trust-item"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={visible ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.5, ease: MOTION_EASE }}
      >
        <motion.span
          className="driveway-form-trust-icon-wrap"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.85, rotate: -4 }}
          animate={visible ? { opacity: 1, scale: 1, rotate: 0 } : undefined}
          transition={{ duration: 0.58, delay: 0.08, ease: MOTION_EASE }}
        >
          <ShieldCheck className="driveway-form-trust-icon" strokeWidth={2} aria-hidden="true" />
        </motion.span>
        <strong className="font-heading" aria-label="150 plus">{jobs}+</strong>
        <span>Jobs completed</span>
      </motion.div>

      <span className="driveway-form-trust-separator" aria-hidden="true" />

      <motion.div
        className="driveway-form-trust-item"
        initial={reduceMotion ? false : { opacity: 0, clipPath: "inset(18% 0 0 0)" }}
        animate={visible ? { opacity: 1, clipPath: "inset(0% 0 0 0)" } : undefined}
        transition={{ duration: 0.56, delay: 0.12, ease: MOTION_EASE }}
      >
        <motion.span
          className="driveway-form-trust-icon-wrap"
          initial={reduceMotion ? false : { opacity: 0, y: 8, scaleY: 0.9 }}
          animate={visible ? { opacity: 1, y: 0, scaleY: 1 } : undefined}
          transition={{ duration: 0.55, delay: 0.18, ease: MOTION_EASE }}
        >
          <CalendarDays className="driveway-form-trust-icon" strokeWidth={2} aria-hidden="true" />
        </motion.span>
        <strong className="font-heading" aria-label="12 plus">{years}+</strong>
        <span>Years in business</span>
      </motion.div>

      <span className="driveway-form-trust-separator" aria-hidden="true" />

      <motion.div
        className="driveway-form-trust-item"
        initial={reduceMotion ? false : { opacity: 0, y: -6 }}
        animate={visible ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.5, delay: 0.18, ease: MOTION_EASE }}
      >
        <span className="driveway-form-trust-icon-wrap">
          <Star className="driveway-form-trust-icon" strokeWidth={2} aria-hidden="true" />
        </span>
        <motion.span
          className="driveway-form-trust-stars"
          aria-label="5 stars"
          initial={reduceMotion ? false : "hidden"}
          animate={visible ? "visible" : "hidden"}
          variants={{
            hidden: {},
            visible: { transition: { delayChildren: 0.26, staggerChildren: 0.11 } },
          }}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <motion.span
              key={index}
              aria-hidden="true"
              variants={{
                hidden: { opacity: 0, scale: 0.72, filter: "blur(3px)" },
                visible: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.34, ease: MOTION_EASE } },
              }}
            >
              <Star fill="currentColor" />
            </motion.span>
          ))}
        </motion.span>
        <span>5-star Google rating</span>
      </motion.div>
    </aside>
  );
}
