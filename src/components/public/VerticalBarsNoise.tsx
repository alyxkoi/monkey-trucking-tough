import { useEffect, useRef } from "react";

type VerticalBarsNoiseProps = {
  className?: string;
  backgroundColor?: string;
  lineColor?: string;
  barColor?: string;
  lineWidth?: number;
  animationSpeed?: number;
  removeWaveLine?: boolean;
};

const motionQuery = "(prefers-reduced-motion: reduce)";

export default function VerticalBarsNoise({
  className = "",
  backgroundColor = "#101012",
  lineColor = "rgba(238, 238, 234, 0.12)",
  barColor = "rgba(238, 238, 234, 0.07)",
  lineWidth = 1,
  animationSpeed = 0.24,
  removeWaveLine = true,
}: VerticalBarsNoiseProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const reducedMotion = window.matchMedia(motionQuery);
    const pointer = { x: 0.5, y: 0.5, active: false };
    let width = 1;
    let height = 1;
    let visible = true;
    let frame = 0;
    let elapsed = 0;

    const resize = () => {
      const bounds = root.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(elapsed);
    };

    const draw = (time: number) => {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, width, height);

      const rowGap = width < 640 ? 28 : 24;
      const pointGap = width < 640 ? 12 : 9;
      const cursorX = pointer.x * width;
      const cursorY = pointer.y * height;

      context.lineCap = "square";
      context.lineJoin = "round";
      context.lineWidth = lineWidth;

      for (let row = -1; row <= Math.ceil(height / rowGap) + 1; row += 1) {
        const baseY = row * rowGap;
        context.beginPath();
        for (let x = 0; x <= width + pointGap; x += pointGap) {
          const dx = x - cursorX;
          const dy = baseY - cursorY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const influence = pointer.active ? Math.max(0, 1 - distance / 280) : 0;
          const phase = x * 0.013 + row * 0.74 + time * 0.00032 * animationSpeed;
          const drift = Math.sin(phase) * 3.2 + Math.sin(phase * 0.43 + row) * 2.1;
          const y = baseY + drift + influence * Math.sin(dx * 0.025) * 8;
          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = lineColor;
        context.stroke();

        const segment = 70;
        for (let x = -segment; x < width + segment; x += segment) {
          const activity = Math.sin(row * 2.91 + x * 0.027 + time * 0.00016 * animationSpeed);
          if (activity < 0.55) continue;
          const length = 14 + ((row * 17 + x) % 30 + 30) % 30;
          const y = baseY + Math.sin(x * 0.013 + row * 0.74 + time * 0.00032 * animationSpeed) * 3.2;
          context.fillStyle = barColor;
          context.fillRect(x + activity * 12, y - 2, length, 4);
        }
      }

      if (!removeWaveLine) {
        context.beginPath();
        for (let y = 0; y <= height; y += 8) {
          const x = width * 0.5 + Math.sin(y * 0.018 + time * 0.00025) * 18;
          if (y === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.strokeStyle = "rgba(255, 49, 49, 0.14)";
        context.stroke();
      }
    };

    const animate = (time: number) => {
      frame = 0;
      elapsed = time;
      draw(time);
      if (visible && !reducedMotion.matches) frame = window.requestAnimationFrame(animate);
    };

    const start = () => {
      if (visible && !reducedMotion.matches && !frame) frame = window.requestAnimationFrame(animate);
      if (reducedMotion.matches) draw(0);
    };

    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = root.getBoundingClientRect();
      pointer.x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      pointer.y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      pointer.active = event.pointerType === "mouse";
    };
    const onPointerLeave = () => { pointer.active = false; };
    const onMotionChange = () => {
      stop();
      start();
    };

    const resizeObserver = new ResizeObserver(resize);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    }, { rootMargin: "120px" });

    resizeObserver.observe(root);
    visibilityObserver.observe(root);
    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerleave", onPointerLeave);
    reducedMotion.addEventListener("change", onMotionChange);
    resize();
    start();

    return () => {
      stop();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [animationSpeed, backgroundColor, barColor, lineColor, lineWidth, removeWaveLine]);

  return (
    <div ref={rootRef} className={`absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
