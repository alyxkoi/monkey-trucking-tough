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

export function preloadPublicRoutes() {
  Object.values(routeLoaderByPath).forEach((load) => void load());
}
