declare module 'fit-file-parser' {
  interface FitParserOptions {
    speedUnit?: string
    lengthUnit?: string
  }
  class FitFileParser {
    constructor(options?: FitParserOptions)
    parse(buffer: Buffer, callback: (error: unknown, data: Record<string, unknown>) => void): void
  }
  export default FitFileParser
}
