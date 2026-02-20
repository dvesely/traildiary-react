import FitFileParser from 'fit-file-parser'
import type { FileParser, ParsedActivity } from '../application/ports.js'
import type { TrackPoint } from '../domain/trackpoint.js'

export class FitParser implements FileParser {
  canParse(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.fit')
  }

  async parse(data: ArrayBuffer, fileName: string): Promise<ParsedActivity[]> {
    const parser = new FitFileParser({ speedUnit: 'km/h', lengthUnit: 'm' })

    const fitData = await new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        parser.parse(
          data as unknown as Buffer,
          (error: unknown, data: Record<string, unknown>) => {
            if (error) reject(error)
            else resolve(data)
          },
        )
      },
    )

    const name = fileName.replace(/\.fit$/i, '')
    const points: TrackPoint[] = []

    const records = (fitData.records as Array<Record<string, unknown>>) ?? []
    let i = 0 // FIXME: should be calculate on trip
    for (const record of records) {
      if (record.position_lat == null || record.position_long == null) continue
      points.push({
        lat: record.position_lat as number,
        lon: record.position_long as number,
        elevation: (record.enhanced_altitude ?? record.altitude ?? 0) as number,
        timestamp: record.timestamp
          ? new Date(record.timestamp as string).getTime()
          : 0,
        distance: record.distance as number,
        index: i++,
      })
    }

    return [{ name, sourceFormat: 'fit', points }]
  }
}
