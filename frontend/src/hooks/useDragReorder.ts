import { useState, useEffect, useCallback, useRef } from 'react'

export interface DragSourceProps {
  draggable: boolean
  onDragStart: (e: React.DragEvent) => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

export interface DropTargetProps {
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}

export interface DragReorderResult<T extends { id: number }> {
  items: T[]
  getDragSourceProps: (index: number) => DragSourceProps
  getDropTargetProps: (index: number) => DropTargetProps
  dragOverIndex: number | null
}

function reorder<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...list]
  const [moved] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, moved)
  return result
}

export function useDragReorder<T extends { id: number }>(
  sourceItems: T[],
  onReorder: (orderedIds: number[]) => void,
): DragReorderResult<T> {
  const [localItems, setLocalItems] = useState(sourceItems)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  // Refs for reading current values in event handlers (avoids stale closures)
  const dragIndexRef = useRef<number | null>(null)
  const overIndexRef = useRef<number | null>(null)
  const localItemsRef = useRef(sourceItems)

  useEffect(() => {
    setLocalItems(sourceItems)
    localItemsRef.current = sourceItems
  }, [sourceItems])

  const findIndexFromPoint = useCallback((clientX: number, clientY: number): number | null => {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    const item = el.closest('[data-index]')
    if (!item) return null
    const idx = parseInt(item.getAttribute('data-index')!, 10)
    return isNaN(idx) ? null : idx
  }, [])

  const completeDrop = useCallback(
    (from: number, to: number) => {
      if (from !== to) {
        const items = localItemsRef.current
        const reordered = reorder(items, from, to)
        setLocalItems(reordered)
        localItemsRef.current = reordered
        onReorder(reordered.map((item) => item.id))
      }
      dragIndexRef.current = null
      overIndexRef.current = null
      setOverIndex(null)
    },
    [onReorder],
  )

  const getDragSourceProps = useCallback(
    (index: number): DragSourceProps => ({
      draggable: true,

      onDragStart: (e: React.DragEvent) => {
        dragIndexRef.current = index
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index))
      },

      onTouchStart: (e: React.TouchEvent) => {
        const touch = e.touches[0]
        dragIndexRef.current = index
        overIndexRef.current = index
        setOverIndex(index)
        void touch.clientY // reference to suppress unused warning
      },

      onTouchMove: (e: React.TouchEvent) => {
        e.preventDefault()
        const touch = e.touches[0]
        const idx = findIndexFromPoint(touch.clientX, touch.clientY)
        if (idx !== null) {
          overIndexRef.current = idx
          setOverIndex(idx)
        }
      },

      onTouchEnd: () => {
        const from = dragIndexRef.current
        const to = overIndexRef.current
        if (from !== null && to !== null) {
          completeDrop(from, to)
        } else {
          dragIndexRef.current = null
          overIndexRef.current = null
          setOverIndex(null)
        }
      },
    }),
    [completeDrop, findIndexFromPoint],
  )

  const getDropTargetProps = useCallback(
    (index: number): DropTargetProps => ({
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        overIndexRef.current = index
        setOverIndex(index)
      },

      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        const from = dragIndexRef.current
        const to = overIndexRef.current
        if (from !== null && to !== null) {
          completeDrop(from, to)
        }
      },

      onDragEnd: () => {
        // Cleanup if drop didn't fire (e.g. drag cancelled with Escape)
        dragIndexRef.current = null
        overIndexRef.current = null
        setOverIndex(null)
      },
    }),
    [completeDrop],
  )

  return {
    items: localItems,
    getDragSourceProps,
    getDropTargetProps,
    dragOverIndex: overIndex,
  }
}
