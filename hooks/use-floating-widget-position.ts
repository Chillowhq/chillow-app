"use client"

import { animate, useMotionValue, useReducedMotion } from "framer-motion"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react"

const FLOATING_WIDGET_POSITION_STORAGE_KEY = "quickserve_order_eta_widget_position_v1"
const DEFAULT_POSITION = { xRatio: 1, yRatio: 1 }
const SNAP_TRANSITION = { type: "spring" as const, stiffness: 520, damping: 38 }

type FloatingWidgetPosition = {
  xRatio: number
  yRatio: number
}

type FloatingWidgetBounds = {
  maxX: number
  maxY: number
}

type FloatingWidgetDragConstraints = {
  left: number
  right: number
  top: number
  bottom: number
}

type UseFloatingWidgetPositionOptions = {
  enabled: boolean
  layoutKey: string
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function isFloatingWidgetPosition(value: unknown): value is FloatingWidgetPosition {
  if (!value || typeof value !== "object") return false

  const position = value as FloatingWidgetPosition
  return Number.isFinite(position.xRatio)
    && Number.isFinite(position.yRatio)
    && position.xRatio >= 0
    && position.xRatio <= 1
    && position.yRatio >= 0
    && position.yRatio <= 1
}

function readSavedPosition(): FloatingWidgetPosition {
  try {
    const stored = localStorage.getItem(FLOATING_WIDGET_POSITION_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) : null
    return isFloatingWidgetPosition(parsed) ? parsed : DEFAULT_POSITION
  } catch {
    return DEFAULT_POSITION
  }
}

function savePosition(position: FloatingWidgetPosition) {
  try {
    localStorage.setItem(FLOATING_WIDGET_POSITION_STORAGE_KEY, JSON.stringify(position))
  } catch {
    // Position memory is a convenience only. Private browsing and storage
    // restrictions must not affect order tracking.
  }
}

function removeSavedPosition() {
  try {
    localStorage.removeItem(FLOATING_WIDGET_POSITION_STORAGE_KEY)
  } catch {
    // See savePosition above.
  }
}

export function resetFloatingWidgetPosition() {
  removeSavedPosition()
}

export function getFloatingWidgetBounds(
  containerWidth: number,
  containerHeight: number,
  widgetWidth: number,
  widgetHeight: number,
): FloatingWidgetBounds {
  return {
    maxX: Math.max(0, containerWidth - widgetWidth),
    maxY: Math.max(0, containerHeight - widgetHeight),
  }
}

export function getFloatingWidgetCoordinates(
  position: FloatingWidgetPosition,
  bounds: FloatingWidgetBounds,
) {
  return {
    x: bounds.maxX * position.xRatio,
    y: bounds.maxY * position.yRatio,
  }
}

export function getFloatingWidgetDragConstraints(bounds: FloatingWidgetBounds): FloatingWidgetDragConstraints {
  return {
    left: 0,
    right: bounds.maxX,
    top: 0,
    bottom: bounds.maxY,
  }
}

export function getEdgeSnappedFloatingWidgetPosition(
  x: number,
  y: number,
  bounds: FloatingWidgetBounds,
): FloatingWidgetPosition {
  const boundedX = clamp(x, 0, bounds.maxX)
  const boundedY = clamp(y, 0, bounds.maxY)

  return {
    xRatio: bounds.maxX === 0 ? 0 : boundedX <= bounds.maxX / 2 ? 0 : 1,
    yRatio: bounds.maxY === 0 ? 0 : boundedY / bounds.maxY,
  }
}

/**
 * Shares one persisted, safe-area-aware drag position between the two compact
 * Order ETA layouts. The containing element supplies the visible safe area;
 * Framer Motion keeps the button inside it while this hook handles snapping.
 */
export function useFloatingWidgetPosition({ enabled, layoutKey }: UseFloatingWidgetPositionOptions) {
  const constraintsRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<HTMLButtonElement>(null)
  const savedPositionRef = useRef<FloatingWidgetPosition>(DEFAULT_POSITION)
  const didDragRef = useRef(false)
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false)
  const [isPositionReady, setIsPositionReady] = useState(false)
  const [dragConstraints, setDragConstraints] = useState<FloatingWidgetDragConstraints>({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  })
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const prefersReducedMotion = useReducedMotion()

  const getBounds = useCallback(() => {
    const container = constraintsRef.current
    const widget = widgetRef.current
    if (!container || !widget) return null

    return getFloatingWidgetBounds(
      container.clientWidth,
      container.clientHeight,
      widget.offsetWidth,
      widget.offsetHeight,
    )
  }, [])

  const applySavedPosition = useCallback((shouldAnimate = false) => {
    const bounds = getBounds()
    if (!bounds) return

    const coordinates = getFloatingWidgetCoordinates(savedPositionRef.current, bounds)
    const nextConstraints = getFloatingWidgetDragConstraints(bounds)
    setDragConstraints((currentConstraints) => (
      currentConstraints.left === nextConstraints.left
      && currentConstraints.right === nextConstraints.right
      && currentConstraints.top === nextConstraints.top
      && currentConstraints.bottom === nextConstraints.bottom
        ? currentConstraints
        : nextConstraints
    ))
    if (shouldAnimate && !prefersReducedMotion) {
      void animate(x, coordinates.x, SNAP_TRANSITION)
      void animate(y, coordinates.y, SNAP_TRANSITION)
    } else {
      x.set(coordinates.x)
      y.set(coordinates.y)
    }

    setIsPositionReady(true)
  }, [getBounds, prefersReducedMotion, x, y])

  useEffect(() => {
    savedPositionRef.current = readSavedPosition()
    setHasRestoredPosition(true)
  }, [])

  useLayoutEffect(() => {
    if (!enabled || !hasRestoredPosition) return

    const frame = window.requestAnimationFrame(() => applySavedPosition())
    return () => window.cancelAnimationFrame(frame)
  }, [applySavedPosition, enabled, hasRestoredPosition, layoutKey])

  useEffect(() => {
    if (!enabled || !hasRestoredPosition) return

    let frame: number | null = null
    const reposition = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => applySavedPosition())
    }

    window.addEventListener("resize", reposition)
    window.addEventListener("orientationchange", reposition)
    window.visualViewport?.addEventListener("resize", reposition)

    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("orientationchange", reposition)
      window.visualViewport?.removeEventListener("resize", reposition)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [applySavedPosition, enabled, hasRestoredPosition])

  const onDragStart = useCallback(() => {
    didDragRef.current = true
  }, [])

  const onDragEnd = useCallback(() => {
    const container = constraintsRef.current
    const widget = widgetRef.current
    const bounds = getBounds()
    if (!container || !widget || !bounds) return

    const containerRect = container.getBoundingClientRect()
    const widgetRect = widget.getBoundingClientRect()
    const position = getEdgeSnappedFloatingWidgetPosition(
      widgetRect.left - containerRect.left,
      widgetRect.top - containerRect.top,
      bounds,
    )
    const coordinates = getFloatingWidgetCoordinates(position, bounds)

    savedPositionRef.current = position
    savePosition(position)

    if (prefersReducedMotion) {
      x.set(coordinates.x)
      y.set(coordinates.y)
    } else {
      void animate(x, coordinates.x, SNAP_TRANSITION)
      void animate(y, coordinates.y, SNAP_TRANSITION)
    }

    // Browsers normally dispatch the post-drag click before Framer's drag-end
    // callback. Clear the guard on the next task as a fallback so a browser
    // that suppresses that click does not swallow the guest's next real tap.
    window.setTimeout(() => {
      didDragRef.current = false
    }, 0)
  }, [getBounds, prefersReducedMotion, x, y])

  const shouldHandleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    if (!didDragRef.current) return true

    event.preventDefault()
    event.stopPropagation()
    didDragRef.current = false
    return false
  }, [])

  return {
    constraintsRef,
    widgetRef,
    x,
    y,
    isPositionReady,
    dragConstraints,
    onDragStart,
    onDragEnd,
    shouldHandleClick,
  }
}
