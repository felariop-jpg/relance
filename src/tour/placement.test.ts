import { describe, expect, it } from 'vitest';
import { placeCard } from './placement';

const viewport = { width: 1440, height: 900 };
const size = { width: 352, height: 220 };
const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  right: left + width,
  bottom: top + height,
});
const overlaps = (p: { top?: number; left?: number }, r: ReturnType<typeof rect>) =>
  p.left! < r.right && p.left! + size.width > r.left && p.top! < r.bottom && p.top! + size.height > r.top;

describe('placeCard', () => {
  it('puts the card beside a table column, not on it', () => {
    const notes = rect(900, 200, 500, 70); // header + first note, at the right
    const place = placeCard(notes, size, viewport);
    expect(place.left! + size.width).toBeLessThanOrEqual(notes.left);
    expect(overlaps(place, notes)).toBe(false);
  });

  it('puts the card below a wide target', () => {
    const wide = rect(16, 120, 1400, 160);
    const place = placeCard(wide, size, viewport);
    expect(place.top).toBeGreaterThanOrEqual(wide.bottom);
  });

  it('never overlaps the target, wherever it is', () => {
    for (const r of [rect(16, 700, 1400, 150), rect(1100, 820, 300, 60), rect(16, 16, 200, 860), rect(600, 300, 300, 300)]) {
      expect(overlaps(placeCard(r, size, viewport), r)).toBe(false);
    }
  });

  it('goes in the corner when there is no target', () => {
    expect(placeCard(null, size, viewport)).toEqual({ right: 16, bottom: 16 });
  });
});
