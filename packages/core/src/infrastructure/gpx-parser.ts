import type { FileParser, ParsedActivity } from '../application/ports.js'
import { calcDistance } from '../domain/distance.js'
import { latLngFromPoint } from '../domain/latlng.js'
import type { TrackPoint } from '../domain/trackpoint.js'

export class GpxParser implements FileParser {
  canParse(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.gpx')
  }

  async parse(data: ArrayBuffer, fileName: string): Promise<ParsedActivity[]> {
    const text = new TextDecoder().decode(data)
    // Use DOMParser in browser, jsdom in Node/tests
    let doc: Document
    if (typeof DOMParser !== 'undefined') {
      doc = new DOMParser().parseFromString(text, 'application/xml')
    } else {
      const { JSDOM } = await import('jsdom')
      doc = new JSDOM(text, { contentType: 'application/xml' }).window.document
    }

    const tracks = doc.getElementsByTagName('trk')
    const activities: ParsedActivity[] = []

    for (let t = 0; t < tracks.length; t++) {
      const track = tracks[t]
      const nameEl = track.getElementsByTagName('name')[0]
      const name = nameEl?.textContent ?? fileName.replace(/\.gpx$/i, '')

      const points: TrackPoint[] = []
      const trkpts = track.getElementsByTagName('trkpt')
      if (!trkpts.length) {
        continue
      }

      let _prevPoint = parsePoint(trkpts[0])
      let _prevDistance = 0

      points.push

      for (let i = 1; i < trkpts.length; i++) {
        const pt = parsePoint(trkpts[i])
        const _distance = calcDistance(
          latLngFromPoint(_prevPoint),
          latLngFromPoint(pt),
        )

        points.push({
          ...pt,
          distance: _distance,
          index: i,
        })

        _prevDistance += _distance
        _prevPoint = pt
      }

      activities.push({ name, sourceFormat: 'gpx', points })
    }

    return activities
  }
}

function parsePoint(pt: Element) {
  const lat = parseFloat(pt.getAttribute('lat') ?? '0')
  const lon = parseFloat(pt.getAttribute('lon') ?? '0')
  const eleEl = pt.getElementsByTagName('ele')[0]
  const elevation = eleEl ? parseFloat(eleEl.textContent ?? '0') : 0
  const timeEl = pt.getElementsByTagName('time')[0]
  const timestamp = timeEl ? new Date(timeEl.textContent ?? '').getTime() : 0

  return { lat, lon, elevation, timestamp }
}
