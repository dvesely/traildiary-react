// apps/mobile/src/infrastructure/expo-sqlite-adapter.ts
import type { SQLiteDatabase } from 'expo-sqlite'
import type { SqliteAdapter } from '@traildiary/db'

export class ExpoSqliteAdapter implements SqliteAdapter {
  constructor(private db: SQLiteDatabase) {}

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this.db.runAsync(sql, params)
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const row = await this.db.getFirstAsync<T>(sql, params)
    return row ?? undefined
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params)
  }

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql)
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    await this.db.withTransactionAsync(fn)
  }
}
