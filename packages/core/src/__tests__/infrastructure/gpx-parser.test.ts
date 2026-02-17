import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GpxParser } from '../../infrastructure/gpx-parser.js'

const SAMPLE_GPX_PATH = resolve(__dirname, '../../../../../_data/tracks/TMB_VII_Konec_posledních_7_km.gpx')

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
    const activities = await parser.parse(arrayBuffer, 'TMB_VII_Konec_posledních_7_km.gpx')

    expect(activities.length).toBeGreaterThan(0)
    expect(activities[0].sourceFormat).toBe('gpx')
    expect(activities[0].points.length).toBeGreaterThan(0)

    const point = activities[0].points[0]
    expect(point.lat).toBeTypeOf('number')
    expect(point.lon).toBeTypeOf('number')
    expect(point.elevation).toBeTypeOf('number')
  })
})
