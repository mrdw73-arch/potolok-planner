'use client'

import { useMemo, useState } from 'react'

type Point = { x: number; y: number }
type ElementType = 'spot' | 'chandelier' | 'cornice'
type CeilingElement = { id: number; type: ElementType; x: number; y: number }

const CANVAS_W = 760
const CANVAS_H = 520
const MIN_SIZE = 80

export default function InteractiveRoom({ width, length, onDimensionsChange }: {
  width: number
  length: number
  onDimensionsChange: (width: number, length: number) => void
}) {
  const [corners, setCorners] = useState<Point[]>([
    { x: 130, y: 90 }, { x: 630, y: 90 }, { x: 630, y: 430 }, { x: 130, y: 430 },
  ])
  const [elements, setElements] = useState<CeilingElement[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dragCorner, setDragCorner] = useState<number | null>(null)
  const [dragElement, setDragElement] = useState<number | null>(null)

  const room = useMemo(() => {
    const xs = corners.map((p) => p.x)
    const ys = corners.map((p) => p.y)
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  }, [corners])

  const scaleX = (room.maxX - room.minX) / Math.max(width, 1)
  const scaleY = (room.maxY - room.minY) / Math.max(length, 1)

  const moveCorner = (index: number, x: number, y: number) => {
    setCorners((current) => current.map((point, i) => {
      if (i === index) return { x, y }
      if (i === (index + 1) % 4 || i === (index + 3) % 4) return { ...point, ...(i === (index + 1) % 4 ? { y } : { x }) }
      return point
    }))
  }

  const pointerPosition = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(30, Math.min(CANVAS_W - 30, ((event.clientX - rect.left) / rect.width) * CANVAS_W)),
      y: Math.max(30, Math.min(CANVAS_H - 30, ((event.clientY - rect.top) / rect.height) * CANVAS_H)),
    }
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragCorner !== null) {
      const p = pointerPosition(event)
      const previous = corners[dragCorner]
      const next = corners[(dragCorner + 1) % 4]
      const opposite = corners[(dragCorner + 2) % 4]
      const horizontal = Math.abs(next.y - previous.y) < 4
      const x = horizontal ? p.x : previous.x
      const y = horizontal ? previous.y : p.y
      if (Math.abs(x - opposite.x) >= MIN_SIZE && Math.abs(y - opposite.y) >= MIN_SIZE) moveCorner(dragCorner, x, y)
    }
    if (dragElement !== null) {
      const p = pointerPosition(event)
      setElements((items) => items.map((item) => item.id === dragElement ? { ...item, x: p.x, y: p.y } : item))
    }
  }

  const addElement = (type: ElementType) => {
    const id = Date.now()
    setElements((items) => [...items, { id, type, x: (room.minX + room.maxX) / 2, y: (room.minY + room.maxY) / 2 }])
    setSelectedId(id)
  }

  const removeSelected = () => {
    if (selectedId === null) return
    setElements((items) => items.filter((item) => item.id !== selectedId))
    setSelectedId(null)
  }

  const selected = elements.find((item) => item.id === selectedId)
  const area = width * length
  const perimeter = 2 * (width + length)

  return (
    <div className="interactive-room">
      <div className="drawing-toolbar">
        <div className="tool-group">
          <button type="button" onClick={() => addElement('spot')}>+ Точечный</button>
          <button type="button" onClick={() => addElement('chandelier')}>+ Люстра</button>
          <button type="button" onClick={() => addElement('cornice')}>+ Карниз</button>
        </div>
        {selected && <button type="button" className="danger-button" onClick={removeSelected}>Удалить выбранный</button>}
      </div>

      <svg
        className="room-svg"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        onPointerMove={handlePointerMove}
        onPointerUp={() => { setDragCorner(null); setDragElement(null) }}
        onPointerLeave={() => { setDragCorner(null); setDragElement(null) }}
      >
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
        <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} className="room-shape" />

        {corners.map((point, index) => (
          <circle
            key={`corner-${index}`}
            cx={point.x}
            cy={point.y}
            r="9"
            className="corner-handle"
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragCorner(index) }}
          />
        ))}

        <text x={(room.minX + room.maxX) / 2} y={room.minY - 22} className="dimension-text" textAnchor="middle">{width} см</text>
        <text x={room.minX - 28} y={(room.minY + room.maxY) / 2} className="dimension-text" textAnchor="middle" transform={`rotate(-90 ${room.minX - 28} ${(room.minY + room.maxY) / 2})`}>{length} см</text>

        {elements.map((item) => (
          <g
            key={item.id}
            transform={`translate(${item.x} ${item.y})`}
            onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedId(item.id); setDragElement(item.id) }}
            className={`ceiling-element ${selectedId === item.id ? 'selected' : ''}`}
          >
            {item.type === 'spot' && <><circle r="15" /><circle r="5" className="element-core" /></>}
            {item.type === 'chandelier' && <><circle r="24" /><path d="M-13 4 L13 4 M-8 10 L8 10" /></>}
            {item.type === 'cornice' && <rect x="-22" y="-8" width="44" height="16" rx="4" />}
            <text y="39" textAnchor="middle">{item.type === 'spot' ? 'Спот' : item.type === 'chandelier' ? 'Люстра' : 'Карниз'}</text>
          </g>
        ))}
      </svg>

      <div className="drawing-footer">
        <div><strong>{area.toFixed(2)} м²</strong><span>площадь</span></div>
        <div><strong>{perimeter.toFixed(2)} м</strong><span>периметр</span></div>
        <div><strong>{elements.filter((e) => e.type === 'spot').length}</strong><span>точечных</span></div>
        <div><strong>{elements.filter((e) => e.type === 'chandelier').length}</strong><span>люстр</span></div>
      </div>
      <p className="drawing-hint">Перетаскивайте углы для изменения формы. Элементы потолка можно перемещать мышью.</p>
    </div>
  )
}
