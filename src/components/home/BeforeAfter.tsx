import { useCallback, useRef, useState, useEffect } from "react";

interface BeforeAfterProps {
  before: string;
  after: string;
  beforeAlt?: string;
  afterAlt?: string;
}

const BeforeAfter = ({ before, after, beforeAlt = "Before", afterAlt = "After" }: BeforeAfterProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const node = containerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      setFromClientX(e.clientX);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setFromClientX]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl select-none touch-none border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
      style={{ aspectRatio: "16 / 10" }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        setFromClientX(e.clientX);
      }}
    >
      <img src={after} alt={afterAlt} className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <img
          src={before}
          alt={beforeAlt}
          className="absolute inset-0 h-full w-[100vw] max-w-none object-cover"
          style={{ width: `${(100 / pos) * 100}%` }}
        />
      </div>

      <span className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs font-semibold tracking-[0.18em] px-3 py-1.5 rounded">
        BEFORE
      </span>
      <span className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs font-semibold tracking-[0.18em] px-3 py-1.5 rounded">
        AFTER
      </span>

      <div
        className="absolute inset-y-0 w-[3px] bg-primary shadow-[0_0_24px_rgba(255,59,59,0.7)] cursor-ew-resize"
        style={{ left: `calc(${pos}% - 1.5px)` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-12 h-12 rounded-full bg-primary border-4 border-white/90 shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
            <polyline points="9 18 15 12 9 6" transform="translate(8 0)" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default BeforeAfter;
