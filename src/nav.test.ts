import { describe, expect, it } from 'vitest';
import { href, landingRoute, parseRoute, routeParams } from './nav';

describe('routes', () => {
  it('reads the route, ignoring query parameters', () => {
    expect(parseRoute('#/contacts')).toBe('contacts');
    expect(parseRoute('#/contacts?notes=missing')).toBe('contacts');
    expect(parseRoute('#/overview')).toBe('overview');
  });

  it('has no route on a plain visit, and Overview for an unknown one', () => {
    expect(parseRoute('')).toBeNull();
    expect(parseRoute('#/')).toBeNull();
    expect(parseRoute('#/nowhere')).toBe('overview');
  });

  it('lands on Overview once there are contacts, else on Contacts', () => {
    expect(landingRoute(0)).toBe('contacts');
    expect(landingRoute(3)).toBe('overview');
  });

  it('builds and reads links with parameters', () => {
    const link = href('contacts', { type: 'client', notes: 'missing' });
    expect(link).toBe('#/contacts?type=client&notes=missing');
    expect(Object.fromEntries(routeParams(link))).toEqual({ type: 'client', notes: 'missing' });
    expect(href('due')).toBe('#/due');
  });
});
