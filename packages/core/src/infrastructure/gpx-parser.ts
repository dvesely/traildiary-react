import type { TrackPoint } from '../domain/trackpoint.js'
import type { FileParser, ParsedActivity } from '../application/ports.js'

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

      for (let i = 0; i < trkpts.length; i++) {
        const pt = trkpts[i]
        const lat = parseFloat(pt.getAttribute('lat') ?? '0')
        const lon = parseFloat(pt.getAttribute('lon') ?? '0')
        const eleEl = pt.getElementsByTagName('ele')[0]
        const elevation = eleEl ? parseFloat(eleEl.textContent ?? '0') : 0
        const timeEl = pt.getElementsByTagName('time')[0]
        const timestamp = timeEl ? new Date(timeEl.textContent ?? '').getTime() : 0

        const hrEl = pt.getElementsByTagName('gpxtpx:hr')[0] ?? pt.getElementsByTagName('hr')[0]
        const cadEl = pt.getElementsByTagName('gpxtpx:cad')[0] ?? pt.getElementsByTagName('cad')[0]

        points.push({
          lat,
          lon,
          elevation,
          timestamp,
          heartRate: hrEl ? parseInt(hrEl.textContent ?? '0', 10) : undefined,
          cadence: cadEl ? parseInt(cadEl.textContent ?? '0', 10) : undefined,
        })
      }

      activities.push({ name, sourceFormat: 'gpx', points })
    }

    return activities
  }
}
