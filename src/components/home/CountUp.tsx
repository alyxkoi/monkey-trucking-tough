import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  suffix?: string;
  duration?: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const CountUp = ({ end, suffix = "", duration = 1600 }: CountUpProps) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVal(end);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            setVal(Math.round(easeOutCubic(t) * end));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      });
    }, { threshold: 0.4 });
    io.observe(node);
    return () => io.disconnect();
  }, [end, duration]);

  return <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>{val}{suffix}</span>;
};

export default CountUp;
