'use client';

import { useMemo } from 'react';
import { angleAt, diagonalLength, distance } from '../../../lib/geometry';

type Point = { x: number; y: number };

type Props = {
  points: Point[];
  toSvg: (point: Point) => Point;
  selectedPoint: number;
  width: number;
  height: number;
};

export default function GeometryMeasurements({ points, toSvg, selectedPoint, width, height }: Props) {
  const data = useMemo(() => {
    if (points.length < 2) return null;
    const next = points[(selectedPoint + 1) % points.length];
    const opposite = points.length > 3 ? points[(selectedPoint + Math.floor(points.length / 2)) % points.length] : null;
    const prev = points[(selectedPoint - 1 + points.length) % points.length];
    const current = points[selectedPoint];
    return {
      wall: distance(current, next),
      angle: points.length > 2 ? angleAt(prev, current, next) : 0,
      diagonal: opposite ? diagonalLength(current, opposite) : 0,
      current: toSvg(current),
      next: toSvg(next),
      opposite: opposite ? toSvg(opposite) : null,
    };
  }, [points, selectedPoint, toSvg]);

  if (!data) return null;

  const midX = (data.current.x + data.next.x) / 2;
  const midY = (data.current.y + data.next.y) / 2;
  const diagMidX = data.opposite ? (data.current.x + data.opposite.x) / 2 : 0;
  const diagMidY = data.opposite ? (data.current.y + data.opposite.y) / 2 : 0;

  return (
    <g className="geometry-measurements" pointerEvents="none">
      {data.opposite && (
        <>
          <line x1={data.current.x} y1={data.current.y} x2={data.opposite.x} y2={data.opposite.y} className="diagonal-line" />
          <text x={diagMidX} y={diagMidY - 10} textAnchor="middle" className="dimension-text">
            {Math.round(data.diagonal)} мм
          </text>
        </>
      )}
      <g transform={`translate(${midX} ${midY - 22})`}>
        <text x={0} y={0} textAnchor="middle" className="dimension-text">{Math.round(data.wall)} мм</text>
      </g>
      <text x={data.current.x + 18} y={data.current.y - 18} className="angle-text">
        {data.angle.toFixed(1)}°
      </text>
      <text x={width - 12} y={height - 12} textAnchor="end" className="measurement-hint">
        Стена {selectedPoint + 1}: {Math.round(data.wall)} мм · угол: {data.angle.toFixed(1)}°
      </text>
    </g>
  );
}
