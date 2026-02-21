// packages/db/src/adapter.ts
export interface SqliteAdapter {
  /** Execute a write statement (INSERT, UPDATE, DELETE). */
  run(sql: string, params?: unknown[]): Promise<void>
  /** Return the first matching row, or undefined. */
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>
  /** Return all matching rows. */
  all<T>(sql: string, params?: unknown[]): Promise<T[]>
  /** Execute raw DDL / PRAGMA (no params). */
  exec(sql: string): Promise<void>
  /** Wrap multiple operations in a transaction; rolls back on throw. */
  transaction(fn: () => Promise<void>): Promise<void>
}
