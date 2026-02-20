import { View, StyleSheet } from 'react-native'
import { Svg, Path, Line, Text as SvgText, Defs, LinearGradient, Stop, Circle } from 'react-native-svg'
import type { TrackPoint } from '@traildiary/core'
import { haversineDistance } from '@traildiary/core'

interface ChartPoint {
  distance: number
  elevation: number
  lat: number
  lon: number
}

function buildChartData(points: TrackPoint[]): ChartPoint[] {
  if (points.length === 0) return []
  let cum = 0
  const data: ChartPoint[] = [
    { distance: 0, elevation: points[0].elevation ?? 0, lat: points[0].lat, lon: points[0].lon },
  ]
  for (let i = 1; i < points.length; i++) {
    cum += haversineDistance(points[i - 1], points[i])
    data.push({
      distance: Math.round(cum * 10) / 10,
      elevation: Math.round(points[i].elevation ?? 0),
      lat: points[i].lat,
      lon: points[i].lon,
    })
  }
  return data
}

interface ElevationChartProps {
  points: TrackPoint[]
  height?: number
  hoveredPoint?: TrackPoint | null
}

const PAD = { top: 8, right: 8, bottom: 24, left: 36 }

export function ElevationChart({ points, height = 140, hoveredPoint }: ElevationChartProps) {
  const data = buildChartData(points)
  if (data.length === 0) return null

  const W = 360
  const H = height
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const minElev = Math.min(...data.map((d) => d.elevation))
  const maxElev = Math.max(...data.map((d) => d.elevation))
  const elevRange = maxElev - minElev || 1
  const maxDist = data[data.length - 1].distance || 1

  function xOf(dist: number) {
    return PAD.left + (dist / maxDist) * innerW
  }
  function yOf(elev: number) {
    return PAD.top + (1 - (elev - minElev) / elevRange) * innerH
  }

  const areaPath =
    `M ${xOf(0)} ${yOf(data[0].elevation)}` +
    data.slice(1).map((d) => ` L ${xOf(d.distance)} ${yOf(d.elevation)}`).join('') +
    ` L ${xOf(maxDist)} ${H - PAD.bottom}` +
    ` L ${xOf(0)} ${H - PAD.bottom} Z`

  const linePath =
    `M ${xOf(0)} ${yOf(data[0].elevation)}` +
    data.slice(1).map((d) => ` L ${xOf(d.distance)} ${yOf(d.elevation)}`).join('')

  const hoveredIdx = hoveredPoint?.index
  const hoveredData = hoveredIdx != null ? data[hoveredIdx] : null

  const yAxisTicks = [minElev, minElev + elevRange / 2, maxElev].map(Math.round)
  const xAxisTicks = [0, maxDist / 2, maxDist].map((v) => Math.round(v * 10) / 10)

  return (
    <View style={[styles.container, { height }]}>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Y axis ticks */}
        {yAxisTicks.map((v) => (
          <SvgText
            key={v}
            x={PAD.left - 4}
            y={yOf(v) + 4}
            textAnchor="end"
            fontSize={9}
            fill="#6b7280"
          >
            {v}
          </SvgText>
        ))}

        {/* X axis ticks */}
        {xAxisTicks.map((v) => (
          <SvgText
            key={v}
            x={xOf(v)}
            y={H - 4}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            {v}km
          </SvgText>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#elevGrad)" />

        {/* Line */}
        <Path d={linePath} stroke="#3b82f6" strokeWidth="1.5" fill="none" />

        {/* Hovered point marker */}
        {hoveredData && (
          <>
            <Line
              x1={xOf(hoveredData.distance)}
              y1={PAD.top}
              x2={xOf(hoveredData.distance)}
              y2={H - PAD.bottom}
              stroke="#9ca3af"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <Circle
              cx={xOf(hoveredData.distance)}
              cy={yOf(hoveredData.elevation)}
              r={4}
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth={1.5}
            />
          </>
        )}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#111' },
})
