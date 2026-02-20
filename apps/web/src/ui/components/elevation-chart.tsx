import { haversineDistance, type TrackPoint } from '@traildiary/core'
import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface ElevationChartProps {
  points: TrackPoint[]
  height?: number
  hoveredPoint?: TrackPoint | null
  onHoverPoint?: (point: TrackPoint | null) => void
}

interface ChartDataPoint {
  distance: number
  elevation: number
  lat: number
  lon: number
}

function buildChartData(points: TrackPoint[]): ChartDataPoint[] {
  if (points.length === 0) return []

  let cumDistance = 0
  const data: ChartDataPoint[] = [
    {
      distance: 0,
      elevation: points[0].elevation,
      lat: points[0].lat,
      lon: points[0].lon,
    },
  ]

  for (let i = 1; i < points.length; i++) {
    cumDistance += haversineDistance(points[i - 1], points[i])
    data.push({
      distance: Math.round(cumDistance * 10) / 10,
      elevation: Math.round(points[i].elevation),
      lat: points[i].lat,
      lon: points[i].lon,
    })
  }

  return data
}

export function ElevationChart({
  points,
  height = 176,
  hoveredPoint,
  onHoverPoint,
}: ElevationChartProps) {
  const data = buildChartData(points)
  let hoveredDistance: number | undefined
  let hoveredIdx: number | undefined
  if (hoveredPoint && data.length > 0) {
    let minDist = Infinity
    let closest = 0
    for (let i = 0; i < points.length; i++) {
      const dLat = points[i].lat - hoveredPoint.lat
      const dLon = points[i].lon - hoveredPoint.lon
      const d = dLat * dLat + dLon * dLon
      if (d < minDist) {
        minDist = d
        closest = i
      }
    }
    hoveredIdx = closest
    hoveredDistance = data[closest].distance
  }

  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        No elevation data
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        onMouseMove={(e) => {
          if (!onHoverPoint) return
          const idx = e.activeTooltipIndex
          if (idx == null) return
          onHoverPoint(points[idx] ?? null)
        }}
        onMouseLeave={() => onHoverPoint?.(null)}
      >
        <defs>
          <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="distance"
          type="number"
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(v) => `${v} km`}
        />
        <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v) => `${v} m`} />
        <Tooltip
          contentStyle={{
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          labelFormatter={(v) => `${v} km`}
          formatter={(v: number) => [`${v} m`, 'Elevation']}
        />
        <Area
          type="monotone"
          dataKey="elevation"
          stroke="#3b82f6"
          fill="url(#elevGradient)"
          strokeWidth={2}
        />
        {hoveredDistance !== undefined && (
          <>
            <ReferenceLine
              key={`rl-${hoveredDistance}`}
              x={hoveredDistance}
              // stroke="#ff0000"
              strokeWidth={2}
              strokeDasharray="3 3"
              label={`${hoveredDistance} km`}
            />
            {hoveredIdx !== undefined && data[hoveredIdx] && (
              <ReferenceDot
                key={`rd-${hoveredDistance}-${hoveredIdx}`}
                x={hoveredDistance}
                y={data[hoveredIdx].elevation}
                r={4}
                // fill="#ff0000"
                stroke="#ffffff"
                strokeWidth={1}
              />
            )}
          </>
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}
