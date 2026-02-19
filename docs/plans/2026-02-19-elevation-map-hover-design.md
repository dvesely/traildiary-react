# Elevation Graph ↔ Map Hover Design

**Date:** 2026-02-19

## Summary

Bidirectional hover interaction between the elevation chart and the map:
- Hovering on the elevation graph shows a dot on the trail at the corresponding GPS position.
- Hovering over the trail on the map shows a vertical reference line on the elevation graph at the corresponding distance.

## Approach

Lift `hoveredPoint: TrackPoint | null` state to `TrailPage`. Both `ElevationChart` and `MapView` receive it as a prop plus an `onHoverPoint` callback. No new libraries or contexts required.

## Data Flow

```
ElevationChart.onMouseMove(activeIndex)
  → look up chartData[activeIndex].{lat, lon}
  → TrailPage.setHoveredPoint(TrackPoint)
  → MapView: update hover-point GeoJSON source → dot on map

MapView.mousemove(lngLat)
  → find nearest TrackPoint in chartPoints by haversine
  → TrailPage.setHoveredPoint(TrackPoint)
  → ElevationChart: ReferenceLine at matching distance

mouseleave on either → setHoveredPoint(null) → clears both indicators
```

## ChartDataPoint

Extend to include `lat` and `lon`:

```ts
interface ChartDataPoint {
  distance: number
  elevation: number
  lat: number
  lon: number
}
```

`buildChartData` already iterates `TrackPoint[]` — copy `lat`/`lon` from each point.

## ElevationChart changes

- New props: `hoveredPoint: TrackPoint | null`, `onHoverPoint: (p: TrackPoint | null) => void`
- `AreaChart.onMouseMove`: use `activeTooltipIndex` to read `chartData[i]` → call `onHoverPoint`
- `AreaChart.onMouseLeave`: call `onHoverPoint(null)`
- Render `<ReferenceLine x={hoveredDistance} />` where `hoveredDistance` is found by scanning `chartData` for the entry nearest to `hoveredPoint` by haversine

## MapView changes

- New props: `hoveredPoint: TrackPoint | null`, `onHoverPoint: (p: TrackPoint | null) => void`, `chartPoints: TrackPoint[]`
- On style load, add a `hover-point` GeoJSON source (initially empty `FeatureCollection`) and a `circle` layer on top of all trail lines
- When `hoveredPoint` prop changes, call `setData` on `hover-point` source with a single `Point` feature or empty `FeatureCollection`
- Circle style: white fill, blue stroke (`#3b82f6`), radius 6px
- `map.on('mousemove')`: find nearest point in `chartPoints` by haversine → `onHoverPoint`
- `map.on('mouseleave')`: `onHoverPoint(null)`

## TrailPage changes

- Add `const [hoveredPoint, setHoveredPoint] = useState<TrackPoint | null>(null)`
- Pass `hoveredPoint`, `onHoverPoint={setHoveredPoint}`, and `chartPoints` to `MapView`
- Pass `hoveredPoint` and `onHoverPoint={setHoveredPoint}` to `ElevationChart`
