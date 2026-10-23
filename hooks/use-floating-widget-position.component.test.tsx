import { describe, expect, it } from "vitest"

import {
  getEdgeSnappedFloatingWidgetPosition,
  getFloatingWidgetBounds,
  getFloatingWidgetCoordinates,
  getFloatingWidgetDragConstraints,
} from "./use-floating-widget-position"

describe("floating Order ETA widget position", () => {
  it("uses the existing bottom-right placement when no saved position exists", () => {
    const bounds = getFloatingWidgetBounds(360, 640, 160, 56)

    expect(getFloatingWidgetCoordinates({ xRatio: 1, yRatio: 1 }, bounds)).toEqual({
      x: 200,
      y: 584,
    })
  })

  it("snaps to the nearest horizontal edge and preserves the vertical placement", () => {
    const bounds = getFloatingWidgetBounds(360, 640, 160, 56)

    expect(getEdgeSnappedFloatingWidgetPosition(40, 292, bounds)).toEqual({
      xRatio: 0,
      yRatio: 0.5,
    })
    expect(getEdgeSnappedFloatingWidgetPosition(170, 292, bounds)).toEqual({
      xRatio: 1,
      yRatio: 0.5,
    })
  })

  it("keeps restored positions inside the available viewport after a resize", () => {
    const position = getEdgeSnappedFloatingWidgetPosition(999, -20, {
      maxX: 200,
      maxY: 584,
    })
    const resizedBounds = getFloatingWidgetBounds(280, 420, 160, 56)

    expect(position).toEqual({ xRatio: 1, yRatio: 0 })
    expect(getFloatingWidgetCoordinates(position, resizedBounds)).toEqual({ x: 120, y: 0 })
  })

  it("uses absolute pixel constraints in the same coordinate system as the motion values", () => {
    const bounds = getFloatingWidgetBounds(360, 640, 160, 56)

    expect(getFloatingWidgetDragConstraints(bounds)).toEqual({
      left: 0,
      right: 200,
      top: 0,
      bottom: 584,
    })
  })

  it("handles a widget that is larger than its safe area without negative coordinates", () => {
    const bounds = getFloatingWidgetBounds(120, 40, 160, 56)

    expect(bounds).toEqual({ maxX: 0, maxY: 0 })
    expect(getEdgeSnappedFloatingWidgetPosition(10, 10, bounds)).toEqual({ xRatio: 0, yRatio: 0 })
  })
})
