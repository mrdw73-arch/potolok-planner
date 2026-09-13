'use client'

import { useEffect, useMemo, useState } from 'react'

type Point = { x: number; y: number }
type ElementType = 'spot' | 'chandelier' | 'cornice'
type CeilingElement = { id: number; type: ElementType; x: number; y: number }
type ShapeMode = 'rectangle' | 'l-shape'

const CANVAS_W = 760
const CANVAS_H = 520
const MIN_SIZE = 70
const MIN_MM = 500

const rectangle = (width: number, length: number): Point[] => {
  const targetW = Math.max(MIN_SIZE, Math.min(CANVAS_W - 80, width * 0.1))
  const targetH = Math.max(MIN_SIZE, Math.min(CANVAS_H - 80, length * 0.1))
  const cx = CANVAS_W / 2
  const cy = CANVAS_H / 2
  return [
    { x: cx - targetW / 2, y: cy - targetH / 2 },
    { x: cx + targetW / 2, y: cy - targetH / 2 },
    { x: cx + targetW / 2, y: cy + targetH / 2 },
    { x: cx - targetW / 2, y: cy + targetH / 2 },
  ]
}

const lShape = (width: number, length: number): Point[] => {
  const base = rectangle(width, length)
  const minX = base[0].x
  const maxX = base[1].x
  const minY = base[0].y
  const maxY = base[2].y
  const cutX = minX + (maxX - minX) * 0.58
  const cutY = minY + (maxY - minY) * 0.48
  return [
    { x: minX, y: minY }, { x: cutX, y: minY }, { x: cutX, y: cutY },
    { x: maxX, y: cutY }, { x: maxX, y: maxY }, { x: minX, y: maxY },
  ]
}

const polygonArea = (points: Point[]) => Math.abs(points.reduce((sum, p, i) => {
  const next = points[(i + 1) % points.length]
  return sum + p.x * next.y - next.x * p.y
}, 0)) / 2

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

export default function InteractiveRoom({ width, length, onDimensionsChange }: {
  width: number
  length: number
  onDimensionsChange: (width: number, length: number) => void
}) {
  const [corners, setCorners] = useState<Point[]>(() => rectangle(width, length))
  const [shapeMode, setShapeMode] = useState<ShapeMode>('rectangle')
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null)
  const [elements, setElements] = useState<CeilingElement[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dragCorner, setDragCorner] = useState<number | null>(null)
  const [dragElement, setDragElement] = useState<number | null>(null)

  useEffect(() => {
    if (shapeMode === 'rectangle' && dragCorner === null) setCorners(rectangle(width, length))
  }, [width, length, shapeMode, dragCorner])

  const bounds = useMemo(() => {
    const xs = corners.map((p) => p.x)
    const ys = corners.map((p) => p.y)
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
  }, [corners])

  const walls = useMemo(() => corners.map((point, index) => ({
    from: point,
    to: corners[(index + 1) % corners.length],
    length: distance(point, corners[(index + 1) % corners.length]),
  })), [corners])

  const areaM2 = polygonArea(corners) * 100 // canvas px² -> approximate dm² with 10 px = 1 m
  const perimeterM = walls.reduce((sum, wall) => sum + wall.length * 0.01, 0)
  const roomWidthMm = Math.max(MIN_MM, Math.round((bounds.maxX - bounds.minX) * 10))
  const roomLengthMm = Math.max(MIN_MM, Math.round((bounds.maxY - bounds.minY) * 10))

  const pointerPosition = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(25, Math.min(CANVAS_W - 25, ((event.clientX - rect.left) / rect.width) * CANVAS_W)),
      y: Math.max(25, Math.min(CANVAS_H - 25, ((event.clientY - rect.top) / rect.height) * CANVAS_H)),
    }
  }

  const finishCornerDrag = () => {
    if (dragCorner !== null) {
      onDimensionsChange(roomWidthMm, roomLengthMm)
    }
    setDragCorner(null)
    setDragElement(null)
  }

  const moveVertex = (index: number, x: number, y: number) => {
    setCorners((current) => {
      const previous = current[(index - 1 + current.length) % current.length]
      const next = current[(index + 1) % current.length]
      const old = current[index]
      const horizontalToPrevious = Math.abs(old.y - previous.y) < Math.abs(old.x - previous.x)
      const horizontalToNext = Math.abs(old.y - next.y) < Math.abs(old.x - next.x)
      const updated = [...current]
      updated[index] = { x, y }
      if (horizontalToPrevious) updated[(index - 1 + current.length) % current.length] = { ...previous, y }
      else updated[(index - 1 + current.length) % current.length] = { ...previous, x }
      if (horizontalToNext) updated[(index + 1) % current.length] = { ...next, y }
      else updated[(index + 1) % current.length] = { ...next, x }
      return updated
    })
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const p = pointerPosition(event)
    if (dragCorner !== null) moveVertex(dragCorner, p.x, p.y)
    if (dragElement !== null) {
      setElements((items) => items.map((item) => item.id === dragElement ? { ...item, x: p.x, y: p.y } : item))
    }
  }

  const setShape = (mode: ShapeMode) => {
    setShapeMode(mode)
    setSelectedVertex(null)
    setCorners(mode === 'rectangle' ? rectangle(width, length) : lShape(width, length))
  }

  const addVertex = () => {
    if (corners.length >= 16) return
    let bestIndex = 0
    let bestLength = 0
    walls.forEach((wall, index) => { if (wall.length > bestLength) { bestLength = wall.length; bestIndex = index } })
    const a = corners[bestIndex]
    const b = corners[(bestIndex + 1) % corners.length]
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const next = [...corners]
    next.splice(bestIndex + 1, 0, midpoint)
    setCorners(next)
    setSelectedVertex(bestIndex + 1)
    setShapeMode('l-shape')
  }

  const deleteVertex = () => {
    if (selectedVertex === null || corners.length <= 4) return
    setCorners((current) => current.filter((_, index) => index !== selectedVertex))
    setSelectedVertex(null)
  }

  const addElement = (type: ElementType) => {
    const id = Date.now() + Math.random()
    setElements((items) => [...items, { id, type, x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }])
    setSelectedId(id)
  }

  const removeSelected = () => {
    if (selectedId === null) return
    setElements((items) => items.filter((item) => item.id !== selectedId))
    setSelectedId(null)
  }

  const selected = elements.find((item) => item.id === selectedId)

  return (
    <div className="interactive-room">
      <div className="drawing-toolbar">
        <div className="tool-group">
          <button type="button" className={shapeMode === 'rectangle' ? 'active' : ''} onClick={() => setShape('rectangle')}>Прямоугольник</button>
          <button type="button" className={shapeMode === 'l-shape' ? 'active' : ''} onClick={() => setShape('l-shape')}>Г-образная</button>
          <button type="button" onClick={addVertex}>＋ Точка</button>
          <button type="button" disabled={selectedVertex === null || corners.length <= 4} onClick={deleteVertex}>− Точка</button>
        </div>
        <div className="tool-group">
          <button type="button" onClick={() => addElement('spot')}>+ Точечный</button>
          <button type="button" onClick={() => addElement('chandelier')}>+ Люстра</button>
          <button type="button" onClick={() => addElement('cornice')}>+ Карниз</button>
          {selected && <button type="button" className="danger-button" onClick={removeSelected}>Удалить элемент</button>}
        </div>
      </div>

      <svg className="room-svg" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} onPointerMove={handlePointerMove} onPointerUp={finishCornerDrag} onPointerLeave={finishCornerDrag}>
        <defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="1" /></pattern></defs>
        <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />
        <polygon points={corners.map((p) => `${p.x},${p.y}`).join(' ')} className="room-shape" />
        {corners.map((point, index) => <circle key={`corner-${index}`} cx={point.x} cy={point.y} r={selectedVertex === index ? 11 : 8} className={`corner-handle ${selectedVertex === index ? 'selected' : ''}`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedVertex(index); setDragCorner(index) }} />)}
        {walls.map((wall, index) => <text key={`wall-${index}`} x={(wall.from.x + wall.to.x) / 2} y={(wall.from.y + wall.to.y) / 2 - 9} className="dimension-text" textAnchor="middle">{Math.round(wall.length * 10)} мм</text>)}
        {elements.map((item) => <g key={item.id} transform={`translate(${item.x} ${item.y})`} onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedId(item.id); setDragElement(item.id) }} className={`ceiling-element ${selectedId === item.id ? 'selected' : ''}`}>
          {item.type === 'spot' && <><circle r="15" /><circle r="5" className="element-core" /></>}
          {item.type === 'chandelier' && <><circle r="24" /><path d="M-13 4 L13 4 M-8 10 L8 10" /></>}
          {item.type === 'cornice' && <rect x="-22" y="-8" width="44" height="16" rx="4" />}
          <text y="39" textAnchor="middle">{item.type === 'spot' ? 'Спот' : item.type === 'chandelier' ? 'Люстра' : 'Карниз'}</text>
        </g>)}
      </svg>

      <div className="wall-editor">
        <div className="wall-editor-title">Стены · мм</div>
        <div className="wall-editor-grid">
          {walls.map((wall, index) => <label key={index}>Стена {index + 1}<input value={Math.round(wall.length * 10)} readOnly /></label>)}
        </div>
      </div>

      <div className="drawing-footer">
        <div><strong>{areaM2.toFixed(2)} м²</strong><span>площадь сложной геометрии</span></div>
        <div><strong>{perimeterM.toFixed(2)} м</strong><span>периметр</span></div>
        <div><strong>{elements.filter((e) => e.type === 'spot').length}</strong><span>точечных</span></div>
        <div><strong>{elements.filter((e) => e.type === 'chandelier').length}</strong><span>люстр</span></div>
      </div>
      <p className="drawing-hint">Выбирайте форму помещения, добавляйте или удаляйте точки и перетаскивайте вершины. Площадь и каждый участок стены пересчитываются автоматически.</p>
    </div>
  )
}
