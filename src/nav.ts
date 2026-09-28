import { useSyncExternalStore } from 'react';

// Hash-based so a static host never 404s on refresh.
export const ROUTES = ['contacts', 'due', 'review', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

function current(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(hash) ? (hash as Route) : 'contacts';
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current, () => 'contacts');
}

export function href(route: Route): string {
  return `#/${route}`;
}
