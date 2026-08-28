import { useCallback, useEffect, useRef } from "react";

type Gradient = readonly [number, number, number];

type WavePoint = {
  x: number;
  y: number;
  wave: { x: number; y: number };
  cursor: { x: number; y: number; vx: number; vy: number };
};

type InteractiveWavesProps = {
  className?: string;
  lineColor?: string;
  lineWidth?: number;
};

class Noise {
  private readonly p = new Uint8Array(512);
  private readonly seed: number;
  private readonly grad3: readonly Gradient[] = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ];

  constructor(seed: number) {
    this.seed = seed > 0 && seed < 1 ? seed : Math.random();
    this.init(this.seed);
  }

  private init(seed: number) {
    const permutation = new Uint8Array(256);
    for (let index = 0; index < 256; index += 1) permutation[index] = index;
    for (let index = 0; index < 256; index += 1) {
      const swapIndex = Math.floor(seed * (index + 1)) % 256;
      const value = permutation[index];
      permutation[index] = permutation[swapIndex];
      permutation[swapIndex] = value;
    }
    for (let index = 0; index < 512; index += 1) this.p[index] = permutation[index & 255];
  }

  private dot(gradient: Gradient, x: number, y: number) {
    return gradient[0] * x + gradient[1] * y;
  }

  perlin2(inputX: number, inputY: number) {
    const X = Math.floor(inputX) & 255;
    const Y = Math.floor(inputY) & 255;
    const x = inputX - Math.floor(inputX);
    const y = inputY - Math.floor(inputY);
    const fade = (value: number) => value * value * value * (value * (value * 6 - 15) + 10);
    const u = fade(x);
    const v = fade(y);
    const lerp = (start: number, end: number, amount: number) => start + amount * (end - start);
    const n00 = this.dot(this.grad3[this.p[X + this.p[Y]] % 12], x, y);
    const n01 = this.dot(this.grad3[this.p[X + this.p[Y + 1]] % 12], x, y - 1);
    const n10 = this.dot(this.grad3[this.p[X + 1 + this.p[Y]] % 12], x - 1, y);
    const n11 = this.dot(this.grad3[this.p[X + 1 + this.p[Y + 1]] % 12], x - 1, y - 1);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }
}

const animationConfig = {
  GRID_X_GAP: 10,
  GRID_Y_GAP: 32,
  GRID_WIDTH_OFFSET: 200,
  GRID_HEIGHT_OFFSET: 30,
  WAVE_TIME_X_FACTOR: 0.0125,
  WAVE_NOISE_X_FACTOR: 0.002,
  WAVE_TIME_Y_FACTOR: 0.005,
  WAVE_NOISE_Y_FACTOR: 0.0015,
  WAVE_NOISE_MAGNITUDE: 12,
  WAVE_AMPLITUDE_X: 32,
  WAVE_AMPLITUDE_Y: 16,
  MOUSE_INFLUENCE_RADIUS: 175,
  MOUSE_FALLOFF_FACTOR: 0.001,
  MOUSE_FORCE_FACTOR: 0.00065,
  MOUSE_SMOOTHING_FACTOR: 0.1,
  MAX_MOUSE_VELOCITY: 100,
  TENSION_STRENGTH: 0.005,
  FRICTION: 0.925,
  CURSOR_DISPLACEMENT_STRENGTH: 2,
  MAX_CURSOR_DISPLACEMENT: 100,
} as const;

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export default function InteractiveWaves({
  className = "",
  lineColor = "rgba(236, 236, 230, 0.15)",
  lineWidth = 0.55,
}: InteractiveWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationState = useRef({
    ctx: null as CanvasRenderingContext2D | null,
    mouse: { x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false },
    lines: [] as WavePoint[][],
    noise: new Noise(Math.random()),
    bounding: null as DOMRect | null,
    animationFrameId: 0,
  });

  const moved = useCallback((point: WavePoint, withCursorForce = true) => {
    const coordinates = {
      x: point.x + point.wave.x + (withCursorForce ? point.cursor.x : 0),
      y: point.y + point.wave.y + (withCursorForce ? point.cursor.y : 0),
    };
    coordinates.x = Math.round(coordinates.x * 10) / 10;
    coordinates.y = Math.round(coordinates.y * 10) / 10;
    return coordinates;
  }, []);

  useEffect(() => {
    const state = animationState.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const context = canvas.getContext("2d");
    if (!context || typeof context.clearRect !== "function" || typeof context.quadraticCurveTo !== "function") return;
    state.ctx = context;

    const reducedMotion = typeof window.matchMedia === "function" ? window.matchMedia(reducedMotionQuery) : null;
    let visible = true;
    let documentVisible = !document.hidden;

    const setSize = () => {
      state.bounding = container.getBoundingClientRect();
      const width = Math.max(1, Math.round(state.bounding.width));
      const height = Math.max(1, Math.round(state.bounding.height));
      const mobile = width < 768;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const setLines = () => {
      if (!state.bounding) return;
      const { width, height } = state.bounding;
      const { GRID_X_GAP, GRID_Y_GAP, GRID_WIDTH_OFFSET, GRID_HEIGHT_OFFSET } = animationConfig;
      const outerWidth = width + GRID_WIDTH_OFFSET;
      const outerHeight = height + GRID_HEIGHT_OFFSET;
      const totalLines = Math.ceil(outerWidth / GRID_X_GAP);
      const totalPoints = Math.ceil(outerHeight / GRID_Y_GAP);
      const xStart = (width - GRID_X_GAP * totalLines) / 2;
      const yStart = (height - GRID_Y_GAP * totalPoints) / 2;

      state.lines = [];
      for (let lineIndex = 0; lineIndex <= totalLines; lineIndex += 1) {
        const points: WavePoint[] = [];
        for (let pointIndex = 0; pointIndex <= totalPoints; pointIndex += 1) {
          points.push({
            x: xStart + GRID_X_GAP * lineIndex,
            y: yStart + GRID_Y_GAP * pointIndex,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          });
        }
        state.lines.push(points);
      }
    };

    const movePoints = (time: number) => {
      const { lines, mouse, noise } = state;
      const {
        WAVE_TIME_X_FACTOR, WAVE_NOISE_X_FACTOR, WAVE_TIME_Y_FACTOR, WAVE_NOISE_Y_FACTOR,
        WAVE_NOISE_MAGNITUDE, WAVE_AMPLITUDE_X, WAVE_AMPLITUDE_Y, MOUSE_INFLUENCE_RADIUS,
        MOUSE_FALLOFF_FACTOR, MOUSE_FORCE_FACTOR, TENSION_STRENGTH, FRICTION,
        CURSOR_DISPLACEMENT_STRENGTH, MAX_CURSOR_DISPLACEMENT,
      } = animationConfig;

      lines.forEach((points) => {
        points.forEach((point) => {
          const noiseInputX = (point.x + time * WAVE_TIME_X_FACTOR) * WAVE_NOISE_X_FACTOR;
          const noiseInputY = (point.y + time * WAVE_TIME_Y_FACTOR) * WAVE_NOISE_Y_FACTOR;
          const movement = noise.perlin2(noiseInputX, noiseInputY) * WAVE_NOISE_MAGNITUDE;
          point.wave.x = Math.cos(movement) * WAVE_AMPLITUDE_X;
          point.wave.y = Math.sin(movement) * WAVE_AMPLITUDE_Y;

          const dx = point.x - mouse.sx;
          const dy = point.y - mouse.sy;
          const distance = Math.hypot(dx, dy);
          const influenceRadius = Math.max(MOUSE_INFLUENCE_RADIUS, mouse.vs);
          if (distance < influenceRadius) {
            const falloff = 1 - distance / influenceRadius;
            const force = Math.cos(distance * MOUSE_FALLOFF_FACTOR) * falloff;
            const forceFactor = force * influenceRadius * mouse.vs * MOUSE_FORCE_FACTOR;
            point.cursor.vx += Math.cos(mouse.a) * forceFactor;
            point.cursor.vy += Math.sin(mouse.a) * forceFactor;
          }

          point.cursor.vx += (0 - point.cursor.x) * TENSION_STRENGTH;
          point.cursor.vy += (0 - point.cursor.y) * TENSION_STRENGTH;
          point.cursor.vx *= FRICTION;
          point.cursor.vy *= FRICTION;
          point.cursor.x += point.cursor.vx * CURSOR_DISPLACEMENT_STRENGTH;
          point.cursor.y += point.cursor.vy * CURSOR_DISPLACEMENT_STRENGTH;
          point.cursor.x = Math.min(MAX_CURSOR_DISPLACEMENT, Math.max(-MAX_CURSOR_DISPLACEMENT, point.cursor.x));
          point.cursor.y = Math.min(MAX_CURSOR_DISPLACEMENT, Math.max(-MAX_CURSOR_DISPLACEMENT, point.cursor.y));
        });
      });
    };

    const drawLines = () => {
      const { ctx, bounding, lines } = state;
      if (!ctx || !bounding) return;
      ctx.clearRect(0, 0, bounding.width, bounding.height);
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;

      lines.forEach((points) => {
        const firstPoint = moved(points[0], false);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let index = 0; index < points.length - 1; index += 1) {
          const currentPoint = moved(points[index], true);
          const nextPoint = moved(points[index + 1], true);
          const centerX = (currentPoint.x + nextPoint.x) / 2;
          const centerY = (currentPoint.y + nextPoint.y) / 2;
          ctx.quadraticCurveTo(currentPoint.x, currentPoint.y, centerX, centerY);
        }
      });
      ctx.stroke();
    };

    const renderStaticFrame = () => {
      movePoints(0);
      drawLines();
    };

    const tick = (time: number) => {
      state.animationFrameId = 0;
      if (!visible || !documentVisible || reducedMotion?.matches) return;
      const { mouse } = state;
      const { MOUSE_SMOOTHING_FACTOR, MAX_MOUSE_VELOCITY } = animationConfig;
      mouse.sx += (mouse.x - mouse.sx) * MOUSE_SMOOTHING_FACTOR;
      mouse.sy += (mouse.y - mouse.sy) * MOUSE_SMOOTHING_FACTOR;
      const dx = mouse.sx - mouse.lx;
      const dy = mouse.sy - mouse.ly;
      const distance = Math.hypot(dx, dy);
      mouse.v = distance;
      mouse.vs += (distance - mouse.vs) * MOUSE_SMOOTHING_FACTOR;
      mouse.vs = Math.min(MAX_MOUSE_VELOCITY, mouse.vs);
      mouse.a = Math.atan2(dy, dx);
      mouse.lx = mouse.sx;
      mouse.ly = mouse.sy;
      movePoints(time);
      drawLines();
      state.animationFrameId = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      if (state.animationFrameId) window.cancelAnimationFrame(state.animationFrameId);
      state.animationFrameId = 0;
    };

    const start = () => {
      if (reducedMotion?.matches) {
        stop();
        renderStaticFrame();
        return;
      }
      if (visible && documentVisible && !state.animationFrameId) state.animationFrameId = window.requestAnimationFrame(tick);
    };

    const resize = () => {
      setSize();
      setLines();
      renderStaticFrame();
      start();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !state.bounding) return;
      const { left, right, top, bottom } = state.bounding;
      if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
        state.mouse.set = false;
        state.mouse.vs = 0;
        return;
      }
      const mouse = state.mouse;
      mouse.x = event.clientX - left;
      mouse.y = event.clientY - top;
      if (!mouse.set) {
        mouse.sx = mouse.x;
        mouse.sy = mouse.y;
        mouse.lx = mouse.x;
        mouse.ly = mouse.y;
        mouse.set = true;
      }
    };

    const onMotionChange = () => {
      stop();
      if (reducedMotion?.matches) renderStaticFrame();
      else start();
    };

    const onVisibilityChange = () => {
      documentVisible = !document.hidden;
      if (documentVisible) start();
      else stop();
    };

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    const visibilityObserver = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      }, { rootMargin: "160px" })
      : null;

    resizeObserver?.observe(container);
    visibilityObserver?.observe(container);
    if (!resizeObserver) window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion?.addEventListener("change", onMotionChange);
    resize();

    return () => {
      stop();
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion?.removeEventListener("change", onMotionChange);
    };
  }, [lineColor, lineWidth, moved]);

  return (
    <div ref={containerRef} className={`interactive-waves ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
