import type { ComponentType } from 'react'

type RouteModule = { default: ComponentType }

export type MainAdminSectionKey =
  | 'overview'
  | 'leads'
  | 'jobs'
  | 'tickets'
  | 'customers'
  | 'money'
  | 'settings'

export const mainAdminRouteLoaders: Record<MainAdminSectionKey, () => Promise<RouteModule>> = {
  overview: () => import('./approved/screens/Overview').then((module) => ({ default: module.Overview })),
  leads: () => import('./approved/screens/LeadsQuotes').then((module) => ({ default: module.LeadsQuotes })),
  jobs: () => import('./approved/screens/Jobs').then((module) => ({ default: module.Jobs })),
  tickets: () => import('./approved/screens/Tickets').then((module) => ({ default: module.Tickets })),
  customers: () => import('./approved/screens/Customers').then((module) => ({ default: module.Customers })),
  money: () => import('./approved/screens/Money').then((module) => ({ default: module.Money })),
  settings: () => import('./approved/screens/SettingsHome').then((module) => ({ default: module.SettingsHome })),
}

export function preloadMainAdminRoute(key: MainAdminSectionKey) {
  return mainAdminRouteLoaders[key]().catch(() => undefined)
}

export function preloadMainAdminRoutes() {
  return Promise.allSettled(Object.values(mainAdminRouteLoaders).map((load) => load()))
}
