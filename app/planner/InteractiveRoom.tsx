'use client'

import { useEffect, useMemo, useState } from 'react'

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

  useEffect(() => {
    const targetW = Math.max(MIN_SIZE, Math.min(CANVAS_W - 80, width * 0.1))
    const targetH = Math.max(MIN_SIZE, Math.min(CANVAS_H - 80, length * 0.1))
    const cx = CANVAS_W / 2
    const cy = CANVAS_H / 2
    setCorners([
      { x: cx - targetW / 2, y: cy - targetH / 2 },
      { x: cx + targetW / 2, y: cy - targetH / 2 },
      { x: cx + targetW / 2, y: cy + targetH / 2 },
      { x: cx - targetW / 2, y: cy + targetH / 2 },
    ])
  }, [width, length])

  const room = useMemo(() => {
    const xs = corners.map((p) => p.x)
    const ys = corners.map((p) => p.y)
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  }, [corners])

  const area = width * length / 1_000_000
  const perimeter = 2 * (width + length) / 1000
  const wallLengths = [width, length, width, length]

  const pointerPosition = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(30, Math.min(CANVAS_W - 30, ((event.clientX - rect.left) / rect.width) * CANVAS_W)),
      y: Math.max(30, Math.min(CANVAS_H - 30, ((event.clientY - rect.top) / rect.height) * CANVAS_H)),
    }
  }

  const finishCornerDrag = () => {
    if (dragCorner !== null) {
      const nextWidth = Math.max(1000, Math.round((room.maxX - room.minX) * 10))
      const nextLength = Math.max(1000, Math.round((room.maxY - room.minY) * 10))
      onDimensionsChange(nextWidth, nextLength)
    }
    setDragCorner(null)
    setDragElement(null)
  }

  const moveCorner = (index: number, x: number, y: number) => {
    setCorners((current) => current.map((point, i) => {
      if (i === index) return { x, y }
      if (i === (index + 1) % 4) return { ...point, y }
      if (i === (index + 3) % 4) return { ...point, x }
      return point
    }))
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragCorner !== null) {
      const p = pointerPosition(event)
      const current = corners[dragCorner]
      const opposite = corners[(dragCorner + 2) % 4]
      const horizontal = dragCorner % 2 === 0
      const x = horizontal ? p.x : current.x
      const y = horizontal ? current.y : p.y
      if (Math.abs(x - opposite.x) >= MIN_SIZE && Math.abs(y - opposite.y) >= MIN_SIZE) moveCorner(dragCorner, x, y)
    }
    if (dragElement !== null) {
      const p = pointerPosition(event)
      setElements((items) => items.map((item) => item.id === dragElement ? { ...item, x: p.x, y: p.y } : item))
    }
  }

  const addElement = (type: ElementType) => {
    const id = Date.now() + Math.random()
    setElements((items) => [...items, { id, type, x: (room.minX + room.maxX) / 2, y: (room.minY + room.maxY) / 2 }])
    setSelectedId(id)
  }

  const removeSelected = () => {
    if (selectedId === null) return
    setElements((items) => items.filter((item) => item.id !== selectedId))
    setSelectedId(null)
  }

  const setWallLength = (wallIndex: number, value: string) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 1000 || parsed > 30000) return
    if (wallIndex % 2 === 0) onDimensionsChange(parsed, length)
    else onDimensionsChange(width, parsed)
  }

  const selected = elements.find((item) => item.id === selectedId)

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

      <svg className="room-svg" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} onPointerMove={handlePointerMove} onPointerUp={finishCornerDrag} onPointerLeave={finishCornerDrag}>
        <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="1" /></pattern></defs>
        <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
        <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} className="room-shape" />
        {corners.map((point, index) => <circle key={`corner-${index}`} cx={point.x} cy={point.y} r="9" className="corner-handle" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragCorner(index) }} />)}
        {wallLengths.map((wall, index) => {
          const a = corners[index], b = corners[(index + 1) % 4]
          return <text key={`wall-${index}`} x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 10} className="dimension-text" textAnchor="middle">{wall} мм</text>
        })}
        {elements.map((item) => <g key={item.id} transform={`translate(${item.x} ${item.y})`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedId(item.id); setDragElement(item.id) }} className={`ceiling-element ${selectedId === item.id ? 'selected' : ''}`}>
          {item.type === 'spot' && <><circle r="15" /><circle r="5" className="element-core" /></>}
          {item.type === 'chandelier' && <><circle r="24" /><path d="M-13 4 L13 4 M-8 10 L8 10" /></>}
          {item.type === 'cornice' && <rect x="-22" y="-8" width="44" height="16" rx="4" />}
          <text y="39" textAnchor="middle">{item.type === 'spot' ? 'Спот' : item.type === 'chandelier' ? 'Люстра' : 'Карниз'}</text>
        </g>)}
      </svg>

      <div className="wall-editor">
        <div className="wall-editor-title">Размеры стен · мм</div>
        <div className="wall-editor-grid">
          {wallLengths.map((wall, index) => <label key={index}>Стена {index + 1}
            <input type="number" min="1000" max="30000" value={wall} onChange={(e) => setWallLength(index, e.target.value)} />
          </label>)}
        </div>
      </div>

      <div className="drawing-footer">
        <div><strong>{area.toFixed(2)} м²</strong><span>площадь</span></div>
        <div><strong>{perimeter.toFixed(2)} м</strong><span>периметр</span></div>
        <div><strong>{elements.filter((e) => e.type === 'spot').length}</strong><span>точечных</span></div>
        <div><strong>{elements.filter((e) => e.type === 'chandelier').length}</strong><span>люстр</span></div>
      </div>
      <p className="drawing-hint">Перетаскивайте углы, вводите размеры стен или перемещайте элементы прямо на плане.</p>
    </div>
  )
}
