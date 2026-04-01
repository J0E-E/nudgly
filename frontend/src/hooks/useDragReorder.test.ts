import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDragReorder } from './useDragReorder'

const items = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
]

describe('useDragReorder', () => {
  it('returns items in original order initially', () => {
    const { result } = renderHook(() => useDragReorder(items, vi.fn()))
    expect(result.current.items).toEqual(items)
  })

  it('returns draggable=true for all getDragSourceProps', () => {
    const { result } = renderHook(() => useDragReorder(items, vi.fn()))
    for (let i = 0; i < items.length; i++) {
      expect(result.current.getDragSourceProps(i).draggable).toBe(true)
    }
  })

  it('dragOverIndex is null when not dragging', () => {
    const { result } = renderHook(() => useDragReorder(items, vi.fn()))
    expect(result.current.dragOverIndex).toBeNull()
  })

  it('updates items when sourceItems change', () => {
    const onReorder = vi.fn()
    const { result, rerender } = renderHook(
      ({ src }) => useDragReorder(src, onReorder),
      { initialProps: { src: items } },
    )
    const newItems = [
      { id: 3, name: 'C' },
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]
    rerender({ src: newItems })
    expect(result.current.items).toEqual(newItems)
  })

  it('getDragSourceProps returns drag-source event handlers', () => {
    const { result } = renderHook(() => useDragReorder(items, vi.fn()))
    const props = result.current.getDragSourceProps(0)
    expect(props).toHaveProperty('onDragStart')
    expect(props).toHaveProperty('onTouchStart')
    expect(props).toHaveProperty('onTouchMove')
    expect(props).toHaveProperty('onTouchEnd')
    expect(props).toHaveProperty('draggable', true)
  })

  it('getDropTargetProps returns drop-target event handlers', () => {
    const { result } = renderHook(() => useDragReorder(items, vi.fn()))
    const props = result.current.getDropTargetProps(0)
    expect(props).toHaveProperty('onDragOver')
    expect(props).toHaveProperty('onDragEnd')
    expect(props).toHaveProperty('onDrop')
  })

  it('calls onReorder with new ID order after drag sequence', () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useDragReorder(items, onReorder))

    // Simulate: drag item 0
    act(() => {
      const source = result.current.getDragSourceProps(0)
      source.onDragStart({
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      } as unknown as React.DragEvent)
    })

    // Simulate dragOver on drop target at index 2
    act(() => {
      const target = result.current.getDropTargetProps(2)
      target.onDragOver({
        preventDefault: vi.fn(),
        dataTransfer: { dropEffect: '' },
      } as unknown as React.DragEvent)
    })

    // Simulate drop on target at index 2
    act(() => {
      const target = result.current.getDropTargetProps(2)
      target.onDrop({
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent)
    })

    expect(onReorder).toHaveBeenCalledWith([2, 3, 1])
  })

  it('updates dragOverIndex during dragOver', () => {
    const { result } = renderHook(() => useDragReorder(items, vi.fn()))

    act(() => {
      const source = result.current.getDragSourceProps(0)
      source.onDragStart({
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      } as unknown as React.DragEvent)
    })

    act(() => {
      const target = result.current.getDropTargetProps(1)
      target.onDragOver({
        preventDefault: vi.fn(),
        dataTransfer: { dropEffect: '' },
      } as unknown as React.DragEvent)
    })

    expect(result.current.dragOverIndex).toBe(1)
  })

  it('resets state after dragEnd without drop', () => {
    const onReorder = vi.fn()
    const { result } = renderHook(() => useDragReorder(items, onReorder))

    act(() => {
      const source = result.current.getDragSourceProps(0)
      source.onDragStart({
        dataTransfer: { effectAllowed: '', setData: vi.fn() },
      } as unknown as React.DragEvent)
    })

    // dragEnd without a drop (e.g. Escape pressed)
    act(() => {
      const target = result.current.getDropTargetProps(0)
      target.onDragEnd({} as React.DragEvent)
    })

    expect(result.current.dragOverIndex).toBeNull()
    expect(onReorder).not.toHaveBeenCalled()
  })
})
