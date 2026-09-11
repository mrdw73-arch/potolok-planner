import { Point, Segment } from './ceiling-model';

export function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lineLength(a: Point, b: Point) {
  return distance(a, b);
}

/** Returns an approximate arc length from a chord and bulge factor. */
export function arcLength(start: Point, end: Point, bulge: number) {
  const chord = distance(start, end);
  if (!bulge || chord === 0) return chord;
  const theta = 4 * Math.atan(Math.abs(bulge));
  const radius = chord / (2 * Math.sin(theta / 2));
  return Math.abs(radius * theta);
}

export function segmentLength(segment: Segment) {
  return segment.type === 'line'
    ? lineLength(segment.start, segment.end)
    : arcLength(segment.start, segment.end, segment.bulge);
}

export function segmentsPerimeter(segments: Segment[]) {
  return segments.reduce((sum, segment) => sum + segmentLength(segment), 0);
}

export function polygonArea(points: Point[]) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function angleAt(prev: Point, current: Point, next: Point) {
  const ax = prev.x - current.x;
  const ay = prev.y - current.y;
  const bx = next.x - current.x;
  const by = next.y - current.y;
  const denominator = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (!denominator) return 0;
  const cosine = Math.min(1, Math.max(-1, (ax * bx + ay * by) / denominator));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function diagonalLength(a: Point, b: Point) {
  return distance(a, b);
}

export function linearElementLength(element: { x: number; y: number; x2?: number; y2?: number; manualLength?: number }) {
  if (typeof element.manualLength === 'number') return element.manualLength;
  if (typeof element.x2 !== 'number' || typeof element.y2 !== 'number') return 0;
  return distance({ x: element.x, y: element.y }, { x: element.x2, y: element.y2 });
}

export function snap(value: number, step: number) {
  if (!step || step <= 0) return value;
  return Math.round(value / step) * step;
}

export function snapPoint(point: Point, step: number): Point {
  return { x: snap(point.x, step), y: snap(point.y, step) };
}

export function orthogonalize(start: Point, point: Point, threshold = 120): Point {
  const dx = Math.abs(point.x - start.x);
  const dy = Math.abs(point.y - start.y);
  if (dx < threshold && dy < threshold) return point;
  if (dx >= dy) return { x: point.x, y: start.y };
  return { x: start.x, y: point.y };
}
