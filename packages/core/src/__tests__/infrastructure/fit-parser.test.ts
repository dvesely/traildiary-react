import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FitParser } from '../../infrastructure/fit-parser.js'

const SAMPLE_FIT_PATH = resolve(__dirname, '../../../../../_data/tracks/TMB_I_.fit')

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = []
  for await (const item of gen) results.push(item)
  return results
}

describe('FitParser', () => {
  const parser = new FitParser()

  it('canParse returns true for .fit files', () => {
    expect(parser.canParse('track.fit')).toBe(true)
    expect(parser.canParse('track.FIT')).toBe(true)
    expect(parser.canParse('track.gpx')).toBe(false)
  })

  it('parses a real FIT file', async () => {
    const buffer = readFileSync(SAMPLE_FIT_PATH)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const activities = await collect(parser.parse(arrayBuffer, 'TMB_I_.fit'))

    expect(activities.length).toBeGreaterThan(0)
    expect(activities[0].sourceFormat).toBe('fit')
    expect(activities[0].points.length).toBeGreaterThan(0)

    const point = activities[0].points[0]
    expect(point.lat).toBeTypeOf('number')
    expect(point.lon).toBeTypeOf('number')
    expect(point.lat).toBeGreaterThan(40)
    expect(point.lat).toBeLessThan(50)
  })
})
