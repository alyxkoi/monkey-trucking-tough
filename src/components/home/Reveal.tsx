import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

const Reveal = ({ children, delay = 0, className = "", as: Tag = "div" }: RevealProps) => {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties = {
    transition:
      "opacity 750ms cubic-bezier(0.22,1,0.36,1), transform 750ms cubic-bezier(0.22,1,0.36,1)",
    transitionDelay: `${delay}ms`,
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(28px)",
    willChange: "opacity, transform",
  };

  const Component = Tag as any;
  return (
    <Component ref={ref as any} style={style} className={className}>
      {children}
    </Component>
  );
};

export default Reveal;
