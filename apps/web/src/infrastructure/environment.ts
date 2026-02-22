import type { Environment, EnvironmentType } from '@traildiary/core/src/application/ports'

export const ENV: Environment = {
  isDevelopment: () => import.meta.env.DEV,
  isProduction: () => import.meta.env.PROD,
  get: () => import.meta.env.MODE as EnvironmentType,
}
