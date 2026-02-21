import { XMLParser } from 'fast-xml-parser'
import type { FileParser, Logger, ParsedActivity } from '../application/ports.js'
import { calcDistance } from '../domain/distance.js'
import { latLngFromPoint } from '../domain/latlng.js'
import type { TrackPoint } from '../domain/trackpoint.js'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['trk', 'trkseg', 'trkpt'].includes(name),
})

export class GpxParser implements FileParser {
  constructor(private readonly logger?: Logger) {}

  canParse(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.gpx')
  }

  async *parse(data: ArrayBuffer, fileName: string): AsyncGenerator<ParsedActivity> {
    this.logger?.debug('GpxParser: start parsing', { fileName, byteLength: data.byteLength })

    const text = new TextDecoder().decode(data)
    const result = xmlParser.parse(text)
    const tracks: unknown[] = result?.gpx?.trk ?? []

    this.logger?.debug('GpxParser: tracks found', { count: tracks.length })

    for (const track of tracks as Record<string, unknown>[]) {
      const name = (track.name as string | undefined) ?? fileName.replace(/\.gpx$/i, '')
      const rawPoints: unknown[] = []

      this.logger?.debug('GpxParser: processing track', { name })

      const segs = track.trkseg as Record<string, unknown>[] | undefined
      if (segs) {
        for (const seg of segs) {
          const pts = seg.trkpt as unknown[] | undefined
          if (pts) rawPoints.push(...pts)
        }
      }

      this.logger?.debug('GpxParser: raw points collected', { track: name, count: rawPoints.length })

      if (rawPoints.length === 0) continue

      const points: TrackPoint[] = []
      let prevPoint = parseTrkpt(rawPoints[0] as Record<string, unknown>)
      const firstPoint = { ...prevPoint, distance: 0, index: 0 }
      points.push(firstPoint)
      this.logger?.trace('GpxParser: point[0]', firstPoint)

      for (let i = 1; i < rawPoints.length; i++) {
        const pt = parseTrkpt(rawPoints[i] as Record<string, unknown>)
        const distance = calcDistance(latLngFromPoint(prevPoint), latLngFromPoint(pt))
        const trackPoint = { ...pt, distance, index: i }
        points.push(trackPoint)
        this.logger?.trace('GpxParser: point[' + i + ']', trackPoint)
        prevPoint = pt
      }

      this.logger?.debug('GpxParser: yielding activity', { name, sourceFormat: 'gpx', pointCount: points.length })
      yield { name, sourceFormat: 'gpx', points }
    }

    this.logger?.debug('GpxParser: parsing complete', { fileName })
  }
}

function parseTrkpt(pt: Record<string, unknown>): Omit<TrackPoint, 'distance' | 'index'> {
  const lat = parseFloat(String(pt['@_lat'] ?? '0'))
  const lon = parseFloat(String(pt['@_lon'] ?? '0'))
  const elevation = pt.ele !== undefined ? parseFloat(String(pt.ele)) : 0
  const timestamp = pt.time ? new Date(String(pt.time)).getTime() : 0
  return { lat, lon, elevation, timestamp }
}
