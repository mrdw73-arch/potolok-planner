'use client';

import { useMemo, useState } from 'react';
import { angleAt, diagonalLength, orthogonalize, polygonArea, polygonPerimeter, snapPoint } from '../../lib/ceiling-calculations';
import { createVariant, duplicateVariant } from '../../lib/variants';
import type { CeilingVariant, Point } from '../../lib/ceiling-model';

const initial: Point[] = [
  { x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3600 }, { x: 0, y: 3600 },
];
const W = 800;
const H = 600;

type SnapMode = 0 | 10 | 50 | 100;

export default function ProfessionalEditor() {
  const [variants, setVariants] = useState<CeilingVariant[]>([createVariant('Стандарт', initial)]);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(0);
  const [snap, setSnap] = useState<SnapMode>(50);
  const [orthogonal, setOrthogonal] = useState(true);
  const variant = variants[active];
  const points = variant.points;
  const area = useMemo(() => polygonArea(points) / 1e6, [points]);
  const perimeter = useMemo(() => polygonPerimeter(points) / 1000, [points]);
  const prev = points[(selected - 1 + points.length) % points.length];
  const current = points[selected];
  const next = points[(selected + 1) % points.length];
  const angle = angleAt(prev, current, next);
  const diagonal = points.length > 2 ? diagonalLength(points[selected], points[(selected + 2) % points.length]) : 0;

  function updatePoints(nextPoints: Point[]) {
    setVariants((items) => items.map((item, index) => index === active ? { ...item, points: nextPoints, updatedAt: new Date().toISOString() } : item));
  }

  function movePoint(index: number, event: React.PointerEvent<SVGCircleElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(...points.map((p) => p.y));
    const scale = Math.min(660 / Math.max(maxX - minX, 1), 460 / Math.max(maxY - minY, 1));
    const ox = (W - (maxX - minX) * scale) / 2;
    const oy = (H - (maxY - minY) * scale) / 2;
    const raw = { x: (event.clientX - rect.left) / rect.width * W, y: (event.clientY - rect.top) / rect.height * H };
    let p = { x: (raw.x - ox) / scale + minX, y: (raw.y - oy) / scale + minY };
    p = snapPoint(p, snap);
    if (orthogonal && index > 0) p = orthogonalize(points[index - 1], p);
    updatePoints(points.map((point, i) => i === index ? { x: Math.max(0, Math.round(p.x)), y: Math.max(0, Math.round(p.y)) } : point));
  }

  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys), maxX = Math.max(...xs), maxY = Math.max(...ys);
  const scale = Math.min(660 / Math.max(maxX - minX, 1), 460 / Math.max(maxY - minY, 1));
  const ox = (W - (maxX - minX) * scale) / 2, oy = (H - (maxY - minY) * scale) / 2;
  const toSvg = (p: Point) => ({ x: ox + (p.x - minX) * scale, y: oy + (p.y - minY) * scale });

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">P</span><span>Potolok Planner · Pro Editor</span></div>
      <div className="top-actions"><button className="ghost" onClick={() => setVariants((v) => [...v, duplicateVariant(v[active], `Вариант ${v.length + 1}`)])}>＋ Вариант</button><button className="primary">Сохранить</button></div>
    </header>
    <section className="workspace">
      <aside className="panel left-panel">
        <div className="panel-title">Чертёж</div>
        <div className="section-title">Варианты потолка</div>
        {variants.map((item, i) => <button key={item.id} className={i === active ? 'feature selected-feature' : 'feature'} onClick={() => setActive(i)}>{item.name}</button>)}
        <div className="section-title">Привязка</div>
        <label>Шаг <select value={snap} onChange={(e) => setSnap(Number(e.target.value) as SnapMode)}><option value={0}>Выключена</option><option value={10}>10 мм</option><option value={50}>50 мм</option><option value={100}>100 мм</option></select></label>
        <label className="check-row"><input type="checkbox" checked={orthogonal} onChange={(e) => setOrthogonal(e.target.checked)} /> Привязка к 90°</label>
        <div className="hint">Перетаскивайте вершины. Размеры, площадь, углы и диагонали пересчитываются автоматически.</div>
      </aside>
      <div className="canvas-area">
        <div className="canvas-toolbar"><span>{variant.name}</span><span className="muted">{points.length} углов · {area.toFixed(2)} м²</span></div>
        <div className="drawing-wrap"><svg className="drawing" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Профессиональный редактор потолка">
          <defs><pattern id="editor-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="currentColor" strokeOpacity=".07" /></pattern></defs>
          <rect width={W} height={H} fill="url(#editor-grid)" />
          <polygon points={points.map(toSvg).map((p) => `${p.x},${p.y}`).join(' ')} className="room" />
          {points.map((p, i) => { const a = toSvg(p), b = toSvg(points[(i + 1) % points.length]); return <g key={i}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={i === selected ? 'wall-hit selected-wall' : 'wall-hit'} onPointerDown={() => setSelected(i)} />
            <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 12} className="dimension-text" textAnchor="middle">{Math.round(Math.hypot(p.x - points[(i + 1) % points.length].x, p.y - points[(i + 1) % points.length].y))} мм</text>
            <circle cx={a.x} cy={a.y} r={selected === i ? 10 : 8} className={selected === i ? 'handle selected' : 'handle'} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setSelected(i); }} onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && movePoint(i, e)} onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)} onPointerCancel={(e) => e.currentTarget.releasePointerCapture(e.pointerId)} />
            <text x={a.x + 12} y={a.y - 12} className="element-label">{i + 1}</text>
          </g>; })}
          {points.length > 2 && <><line x1={toSvg(points[selected]).x} y1={toSvg(points[selected]).y} x2={toSvg(points[(selected + 2) % points.length]).x} y2={toSvg(points[(selected + 2) % points.length]).y} className="diagonal-line" /><text x={(toSvg(points[selected]).x + toSvg(points[(selected + 2) % points.length]).x) / 2} y={(toSvg(points[selected]).y + toSvg(points[(selected + 2) % points.length]).y) / 2 - 8} className="dimension-text" textAnchor="middle">↗ {Math.round(diagonal)} мм</text><text x={toSvg(current).x + 14} y={toSvg(current).y + 24} className="dimension-text">∠ {angle.toFixed(1)}°</text></>}
          <text x={W / 2} y={H / 2} className="area-text" textAnchor="middle">{area.toFixed(2)} м²</text>
        </svg></div>
      </div>
      <aside className="panel right-panel">
        <div className="panel-title">Измерения</div>
        <div className="stat"><span>Площадь</span><strong>{area.toFixed(2)} м²</strong></div>
        <div className="stat"><span>Периметр</span><strong>{perimeter.toFixed(2)} м</strong></div>
        <div className="stat"><span>Угол {selected + 1}</span><strong>{angle.toFixed(1)}°</strong></div>
        <div className="stat"><span>Диагональ</span><strong>{(diagonal / 1000).toFixed(2)} м</strong></div>
        <div className="divider" />
        <div className="section-title">Архитектура Potolok Planner</div>
        <div className="hint">В эту модель уже заложены варианты потолка, дуги, линейные элементы, каталог материалов и работ, фото объекта, задачи, календарь и финансовые операции. Следующий слой — подключить их к интерфейсу проекта и смете.</div>
      </aside>
    </section>
  </main>;
}
