import type { Logger, LoggerOptions, LogLevel } from '@traildiary/core'
import { ENV } from './environment'

const LEVEL_RANK: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
}

export function useLogger() {
  return logger
}

function createLogger(options: LoggerOptions): Logger {
  const enabled = new Set(options.logLevels)

  function emit(
    level: LogLevel,
    consoleFn: (...args: unknown[]) => void,
    message: string,
    data?: unknown,
  ) {
    if (!enabled.has(level)) return
    const prefix = `[${level.toUpperCase()}]`
    if (data !== undefined) {
      consoleFn(prefix, message, data)
    } else {
      consoleFn(prefix, message)
    }
  }

  return {
    trace: (message, data) => emit('trace', console.debug, message, data),
    debug: (message, data) => emit('debug', console.debug, message, data),
    info: (message, data) => emit('info', console.info, message, data),
    warn: (message, data) => emit('warn', console.warn, message, data),
    error: (message, data) => emit('error', console.error, message, data),
  }
}

// In dev mode log everything; in production only warnings and errors.
const defaultLogLevels: LogLevel[] = ENV.isDevelopment()
  ? ['trace', 'debug', 'info', 'warn', 'error']
  : ['warn', 'error']

export const logger = createLogger({ logLevels: defaultLogLevels })

export { createLogger }
export type { LoggerOptions }
