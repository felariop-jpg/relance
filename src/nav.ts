import { useSyncExternalStore } from 'react';

// Hash-based so a static host never 404s on refresh.
export const ROUTES = ['overview', 'contacts', 'due', 'review', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

/** The route in a hash like "#/contacts?notes=missing", or null when there is none (first visit). */
export function parseRoute(hash: string): Route | null {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  if (!path) return null;
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : 'overview';
}

/** Query parameters after the route, e.g. #/contacts?notes=missing&type=client. */
export function routeParams(hash = window.location.hash): URLSearchParams {
  const query = hash.split('?')[1] ?? '';
  return new URLSearchParams(query);
}

/** Where the app opens without a route: Overview once there are contacts, else Contacts to add some. */
export function landingRoute(contactCount: number): Route {
  return contactCount > 0 ? 'overview' : 'contacts';
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

/** The current route; null until a landing route is chosen. */
export function useRoute(): Route | null {
  return useSyncExternalStore(subscribe, () => parseRoute(window.location.hash), () => null);
}

/** The raw hash, for screens that read routeParams. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => '');
}

export function href(route: Route, params?: Record<string, string>): string {
  const query = params ? new URLSearchParams(params).toString() : '';
  return `#/${route}${query ? `?${query}` : ''}`;
}
