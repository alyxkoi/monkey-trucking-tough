export const publicRouteLoaders = {
  services: () => import("./pages/Services"),
  materials: () => import("./pages/Materials"),
  projects: () => import("./pages/Projects"),
  contact: () => import("./pages/Contact"),
};

const routeLoaderByPath: Record<string, () => Promise<unknown>> = {
  "/services": publicRouteLoaders.services,
  "/materials": publicRouteLoaders.materials,
  "/projects": publicRouteLoaders.projects,
  "/contact": publicRouteLoaders.contact,
};

export function preloadPublicRoute(path: string) {
  void routeLoaderByPath[path]?.();
}

let preloadScheduled = false;

export function preloadPublicRoutes() {
  if (preloadScheduled) return;
  preloadScheduled = true;

  const queue = Object.values(routeLoaderByPath);
  const loadNext = () => {
    const load = queue.shift();
    if (!load) return;
    void load().finally(() => {
      if (queue.length === 0) return;
      if (window.requestIdleCallback) {
        window.requestIdleCallback(loadNext, { timeout: 1800 });
      } else {
        window.setTimeout(loadNext, 450);
      }
    });
  };

  window.setTimeout(() => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(loadNext, { timeout: 2200 });
    } else {
      loadNext();
    }
  }, 2500);
}
