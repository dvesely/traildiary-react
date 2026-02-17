import { PGlite } from '@electric-sql/pglite'

let instance: PGlite | null = null

export async function getPgliteClient(dataDir?: string): Promise<PGlite> {
  if (instance) return instance
  instance = new PGlite(dataDir ?? 'idb://traildiary')
  return instance
}

export async function runMigrations(client: PGlite, sql: string): Promise<void> {
  await client.exec(sql)
}

export async function resetClient(): Promise<void> {
  if (instance) {
    await instance.close()
    instance = null
  }
}
