import Database from 'better-sqlite3'
import type { SqliteAdapter } from '../adapter.js'

export function createTestAdapter(path = ':memory:'): SqliteAdapter {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  return {
    async run(sql, params = []) {
      db.prepare(sql).run(...params)
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).get(...params) as T | undefined
    },
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...params) as T[]
    },
    async exec(sql) {
      db.exec(sql)
    },
    async transaction(fn) {
      db.exec('BEGIN')
      try {
        await fn()
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
  }
}
