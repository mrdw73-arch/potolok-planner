import { Point, snapPoint } from './geometry';

export type SnapStep = 0 | 10 | 50 | 100;

export function snapEditorPoint(point: Point, step: SnapStep) {
  return step === 0 ? point : snapPoint(point, step);
}

export function snapOrthogonalPoint(
  origin: Point,
  point: Point,
  step: SnapStep,
) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const snapped = horizontal
    ? { x: point.x, y: origin.y }
    : { x: origin.x, y: point.y };

  return snapEditorPoint(snapped, step);
}

export function editorPoint(
  origin: Point,
  point: Point,
  options: { snapStep: SnapStep; orthogonal: boolean },
) {
  const constrained = options.orthogonal
    ? snapOrthogonalPoint(origin, point, options.snapStep)
    : point;
  return snapEditorPoint(constrained, options.snapStep);
}
