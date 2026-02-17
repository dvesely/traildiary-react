import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { haversineDistance, type TrackPoint } from '@traildiary/core'

interface ElevationChartProps {
  points: TrackPoint[]
}

interface ChartDataPoint {
  distance: number
  elevation: number
}

function buildChartData(points: TrackPoint[]): ChartDataPoint[] {
  if (points.length === 0) return []

  let cumDistance = 0
  const data: ChartDataPoint[] = [{ distance: 0, elevation: points[0].elevation }]

  for (let i = 1; i < points.length; i++) {
    cumDistance += haversineDistance(points[i - 1], points[i])
    data.push({ distance: Math.round(cumDistance * 10) / 10, elevation: Math.round(points[i].elevation) })
  }

  return data
}

export function ElevationChart({ points }: ElevationChartProps) {
  const data = buildChartData(points)

  if (data.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">No elevation data</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <defs>
          <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="distance"
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(v) => `${v} km`}
        />
        <YAxis
          stroke="#6b7280"
          fontSize={12}
          tickFormatter={(v) => `${v} m`}
        />
        <Tooltip
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
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
      </AreaChart>
    </ResponsiveContainer>
  )
}
