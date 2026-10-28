const GAP = 14;
const MARGIN = 8;

/**
 * Where the card goes so it never covers the highlighted area. A target up to
 * 60 % of the screen wide (a table column, a button, a card) gets the card
 * beside it (left, then right), so the column stays readable; wider ones get it
 * below, then above. Failing all of those, the corner that doesn't overlap it.
 */
export function placeCard(
  rect: { top: number; left: number; right: number; bottom: number; width: number } | null,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): { top?: number; left?: number; right?: number; bottom?: number } {
  const { width: w, height: h } = size;
  if (!rect) return { right: 16, bottom: 16 };
  const clamp = (v: number, max: number) => Math.min(Math.max(MARGIN, v), max);
  const top = clamp(rect.top, viewport.height - h - MARGIN);
  const left = clamp(rect.left, viewport.width - w - MARGIN);
  const beside = [
    { top, left: rect.left - GAP - w },
    { top, left: rect.right + GAP },
  ];
  const stacked = [
    { top: rect.bottom + GAP, left },
    { top: rect.top - GAP - h, left },
  ];
  const candidates = rect.width <= viewport.width * 0.6 ? [...beside, ...stacked] : [...stacked, ...beside];
  const fits = (p: { top: number; left: number }) =>
    p.left >= MARGIN && p.top >= MARGIN && p.left + w <= viewport.width - MARGIN && p.top + h <= viewport.height - MARGIN;
  const found = candidates.find(fits);
  if (found) return found;
  const overlaps = (p: { top: number; left: number }) =>
    p.left < rect.right && p.left + w > rect.left && p.top < rect.bottom && p.top + h > rect.top;
  const corners = [
    { top: viewport.height - h - 16, left: viewport.width - w - 16 },
    { top: viewport.height - h - 16, left: 16 },
    { top: 16, left: viewport.width - w - 16 },
    { top: 16, left: 16 },
  ];
  return corners.find((c) => !overlaps(c)) ?? corners[0];
}
