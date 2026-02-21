import FitFileParser from 'fit-file-parser'
import type { FileParser, Logger, ParsedActivity } from '../application/ports.js'
import type { TrackPoint } from '../domain/trackpoint.js'

export class FitParser implements FileParser {
  constructor(private readonly logger?: Logger) {}

  canParse(fileName: string): boolean {
    return fileName.toLowerCase().endsWith('.fit')
  }

  async *parse(data: ArrayBuffer, fileName: string): AsyncGenerator<ParsedActivity> {
    this.logger?.debug('FitParser: start parsing', { fileName, byteLength: data.byteLength })

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
    this.logger?.debug('FitParser: records found', { count: records.length })

    let i = 0
    for (const record of records) {
      this.logger?.trace('FitParser: raw record', record)

      if (record.position_lat == null || record.position_long == null) {
        this.logger?.trace('FitParser: skipping record without position', record)
        continue
      }

      const trackPoint: TrackPoint = {
        lat: record.position_lat as number,
        lon: record.position_long as number,
        elevation: (record.enhanced_altitude ?? record.altitude ?? 0) as number,
        timestamp: record.timestamp
          ? new Date(record.timestamp as string).getTime()
          : 0,
        distance: record.distance as number,
        index: i++,
      }
      points.push(trackPoint)
      this.logger?.trace('FitParser: point[' + trackPoint.index + ']', trackPoint)
    }

    this.logger?.debug('FitParser: points collected', { count: points.length })

    if (points.length > 0) {
      this.logger?.debug('FitParser: yielding activity', { name, sourceFormat: 'fit', pointCount: points.length })
      yield { name, sourceFormat: 'fit', points }
    }

    this.logger?.debug('FitParser: parsing complete', { fileName })
  }
}
