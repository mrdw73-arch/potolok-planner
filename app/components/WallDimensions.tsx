'use client';

import { useMemo } from 'react';

type Point = { x: number; y: number };

type Props = {
  points: Point[];
  width: number;
  height: number;
  selectedWall?: number;
};

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function formatMm(value: number) {
  return `${Math.round(value)} мм`;
}

export default function WallDimensions({ points, width, height, selectedWall = -1 }: Props) {
  const dimensions = useMemo(() => {
    if (points.length < 2) return [];

    return points.map((point, index) => {
      const next = points[(index + 1) % points.length];
      const length = distance(point, next);
      const dx = next.x - point.x;
      const dy = next.y - point.y;
      const segmentLength = Math.max(length, 1);
      const ux = dx / segmentLength;
      const uy = dy / segmentLength;
      const nx = -uy;
      const ny = ux;
      const offset = 42;
      const extension = 18;
      const startX = point.x + nx * offset;
      const startY = point.y + ny * offset;
      const endX = next.x + nx * offset;
      const endY = next.y + ny * offset;
      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;
      const arrow = 8;
      const angle = Math.atan2(uy, ux) * 180 / Math.PI;

      return {
        index,
        length,
        selected: index === selectedWall,
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        extStart: { x: point.x + nx * (offset - extension), y: point.y + ny * (offset - extension) },
        extEnd: { x: next.x + nx * (offset - extension), y: next.y + ny * (offset - extension) },
        mid: { x: midX, y: midY },
        angle,
        arrow,
      };
    });
  }, [points, selectedWall]);

  return (
    <g className="wall-dimensions" pointerEvents="none">
      {dimensions.map((dimension) => {
        const scaleX = width ? 100 / width : 0;
        const scaleY = height ? 100 / height : 0;
        const toX = (value: number) => `${value * scaleX}%`;
        const toY = (value: number) => `${value * scaleY}%`;

        return (
          <g key={dimension.index} className={dimension.selected ? 'dimension-group selected' : 'dimension-group'}>
            <line x1={toX(dimension.extStart.x)} y1={toY(dimension.extStart.y)} x2={toX(dimension.start.x)} y2={toY(dimension.start.y)} className="dimension-extension" />
            <line x1={toX(dimension.extEnd.x)} y1={toY(dimension.extEnd.y)} x2={toX(dimension.end.x)} y2={toY(dimension.end.y)} className="dimension-extension" />
            <line x1={toX(dimension.start.x)} y1={toY(dimension.start.y)} x2={toX(dimension.end.x)} y2={toY(dimension.end.y)} className="dimension-line" />
            <path d={`M ${toX(dimension.start.x + dimension.arrow)} ${toY(dimension.start.y + dimension.arrow)} L ${toX(dimension.start.x)} ${toY(dimension.start.y)} L ${toX(dimension.start.x + dimension.arrow)} ${toY(dimension.start.y - dimension.arrow)}`} className="dimension-arrow" />
            <path d={`M ${toX(dimension.end.x - dimension.arrow)} ${toY(dimension.end.y + dimension.arrow)} L ${toX(dimension.end.x)} ${toY(dimension.end.y)} L ${toX(dimension.end.x - dimension.arrow)} ${toY(dimension.end.y - dimension.arrow)}`} className="dimension-arrow" />
            <g transform={`translate(${toX(dimension.mid.x)} ${toY(dimension.mid.y)}) rotate(${dimension.angle})`}>
              <rect x="-48" y="-13" width="96" height="26" rx="7" className="dimension-bg" />
              <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" className="dimension-text">{formatMm(dimension.length)}</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
