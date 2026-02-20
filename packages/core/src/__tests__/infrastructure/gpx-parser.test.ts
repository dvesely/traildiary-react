import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GpxParser } from '../../infrastructure/gpx-parser.js'

const SAMPLE_GPX_PATH = resolve(__dirname, '../../../../../_data/tracks/TMB_VII_Konec_posledních_7_km.gpx')

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = []
  for await (const item of gen) results.push(item)
  return results
}

describe('GpxParser', () => {
  const parser = new GpxParser()

  it('canParse returns true for .gpx files', () => {
    expect(parser.canParse('track.gpx')).toBe(true)
    expect(parser.canParse('track.GPX')).toBe(true)
    expect(parser.canParse('track.fit')).toBe(false)
  })

  it('parses a real GPX file', async () => {
    const buffer = readFileSync(SAMPLE_GPX_PATH)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const activities = await collect(parser.parse(arrayBuffer, 'TMB_VII_Konec_posledních_7_km.gpx'))

    expect(activities.length).toBeGreaterThan(0)
    expect(activities[0].sourceFormat).toBe('gpx')
    expect(activities[0].points.length).toBeGreaterThan(0)

    const point = activities[0].points[0]
    expect(point.lat).toBeTypeOf('number')
    expect(point.lon).toBeTypeOf('number')
    expect(point.elevation).toBeTypeOf('number')
  })

  it('yields nothing for gpx with no tracks', async () => {
    const xml = `<?xml version="1.0"?><gpx version="1.1"></gpx>`
    const buf = new TextEncoder().encode(xml).buffer
    const activities = await collect(parser.parse(buf, 'empty.gpx'))
    expect(activities).toEqual([])
  })

  it('yields one activity per track element', async () => {
    const xml = `<?xml version="1.0"?><gpx version="1.1">
      <trk><name>Track A</name><trkseg>
        <trkpt lat="47.0" lon="13.0"><ele>1000</ele><time>2024-01-01T08:00:00Z</time></trkpt>
        <trkpt lat="47.1" lon="13.1"><ele>1100</ele><time>2024-01-01T09:00:00Z</time></trkpt>
      </trkseg></trk>
      <trk><name>Track B</name><trkseg>
        <trkpt lat="48.0" lon="14.0"><ele>500</ele><time>2024-01-02T08:00:00Z</time></trkpt>
        <trkpt lat="48.1" lon="14.1"><ele>600</ele><time>2024-01-02T09:00:00Z</time></trkpt>
      </trkseg></trk>
    </gpx>`
    const buf = new TextEncoder().encode(xml).buffer
    const activities = await collect(parser.parse(buf, 'multi.gpx'))
    expect(activities).toHaveLength(2)
    expect(activities[0].name).toBe('Track A')
    expect(activities[1].name).toBe('Track B')
  })
})
