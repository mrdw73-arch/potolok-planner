export type DrawPoint = { x: number; y: number };

export function snapDrawingPoint(point: DrawPoint, step: number) {
  if (!Number.isFinite(step) || step <= 0) return point;
  return { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step };
}

export function snapOrthogonalPoint(start: DrawPoint, point: DrawPoint, step = 1) {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  const snapped = Math.abs(dx) >= Math.abs(dy) ? { x: point.x, y: start.y } : { x: start.x, y: point.y };
  return snapDrawingPoint(snapped, step);
}

export function drawingSegmentLength(a: DrawPoint, b: DrawPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function drawingAngle(a: DrawPoint, b: DrawPoint) {
  return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
}

export function nearestWallPoint(points: DrawPoint[], point: DrawPoint) {
  if (points.length < 2) return null;
  let best: { index: number; point: DrawPoint; distance: number } | null = null;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const denominator = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * vx + (point.y - a.y) * vy) / denominator));
    const projected = { x: a.x + vx * t, y: a.y + vy * t };
    const distance = drawingSegmentLength(point, projected);
    if (!best || distance < best.distance) best = { index: i, point: projected, distance };
  }
  return best;
}

export function insertPointOnWall(points: DrawPoint[], wallIndex: number, point: DrawPoint) {
  if (points.length < 2 || wallIndex < 0 || wallIndex >= points.length) return points;
  return [...points.slice(0, wallIndex + 1), point, ...points.slice(wallIndex + 1)];
}

export function removePoint(points: DrawPoint[], index: number, minimum = 3) {
  if (points.length <= minimum || index < 0 || index >= points.length) return points;
  return points.filter((_, current) => current !== index);
}

export function moveDrawingPoint(points: DrawPoint[], index: number, point: DrawPoint) {
  if (index < 0 || index >= points.length) return points;
  return points.map((current, currentIndex) => currentIndex === index ? point : current);
}

export function moveSegment(points: DrawPoint[], wallIndex: number, delta: DrawPoint) {
  if (points.length < 2 || wallIndex < 0 || wallIndex >= points.length) return points;
  const next = points.map((point) => ({ ...point }));
  const end = (wallIndex + 1) % points.length;
  next[wallIndex] = { x: next[wallIndex].x + delta.x, y: next[wallIndex].y + delta.y };
  next[end] = { x: next[end].x + delta.x, y: next[end].y + delta.y };
  return next;
}
