import "@testing-library/jest-dom";

if (typeof window !== "undefined") {
  class MemoryStorage implements Storage {
    private values = new Map<string, string>();
    get length() { return this.values.size; }
    clear() { this.values.clear(); }
    getItem(key: string) { return this.values.get(key) ?? null; }
    key(index: number) { return [...this.values.keys()][index] ?? null; }
    removeItem(key: string) { this.values.delete(key); }
    setItem(key: string, value: string) { this.values.set(key, String(value)); }
  }

  const storage = new MemoryStorage();
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  class TestResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  class TestIntersectionObserver {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  }
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
  Object.defineProperty(globalThis, "IntersectionObserver", { configurable: true, value: TestIntersectionObserver });

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => ({
      beginPath() {},
      fillRect() {},
      lineTo() {},
      moveTo() {},
      setTransform() {},
      stroke() {},
      fillStyle: "",
      lineCap: "butt",
      lineJoin: "miter",
      lineWidth: 1,
      strokeStyle: "",
    }),
  });
}
