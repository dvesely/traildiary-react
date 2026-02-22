// apps/web/src/infrastructure/wa-sqlite-adapter.ts

import { sleep } from '@traildiary/core'
import { SCHEMA_SQL, type SqliteAdapter } from '@traildiary/db'
import * as SQLite from 'wa-sqlite'
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs'
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js'
import { logger } from './logger'

type SQLiteAPI = ReturnType<typeof SQLite.Factory>

const DB_NAME = 'traildiary'
const migrating = true
let dbInitialized = false
let dbInitializing = false
let adapter: SqliteAdapter // Store the DB instance globally or in a singleton

export const getWaSqliteAdapter = () => adapter

class WaSqliteAdapter implements SqliteAdapter {
  constructor(
    private readonly sqlite3: SQLiteAPI,
    private readonly db: number,
  ) {}

  // wa-sqlite's async WASM mode is not safe for concurrent callers — two
  // overlapping statements on the same db handle produce SQLITE_MISUSE.
  // This mutex serializes all public operations so only one WASM call runs
  // at a time.  _inTransaction bypasses the lock for calls made from within
  // a held transaction (transaction holds the lock for its whole duration;
  // re-acquiring would deadlock since fn() calls run/get/all internally).
  private _mutex: Promise<void> = Promise.resolve()
  private _inTransaction = false

  private async _withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void
    const ticket = new Promise<void>((r) => {
      release = r
    })
    const prev = this._mutex
    this._mutex = ticket
    await prev
    try {
      return await fn()
    } finally {
      release()
    }
  }

  async run(sql: string, params: unknown[] = []): Promise<void> {
    if (this._inTransaction) {
      await this._rawQuery(sql, params)
      return
    }
    await this._withLock(() => this._rawQuery(sql, params))
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    if (this._inTransaction) return (await this._rawQuery<T>(sql, params))[0]
    return this._withLock(() =>
      this._rawQuery<T>(sql, params).then((r) => r[0]),
    )
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (this._inTransaction) return this._rawQuery<T>(sql, params)
    return this._withLock(() => this._rawQuery<T>(sql, params))
  }

  async exec(sql: string): Promise<void> {
    if (this._inTransaction) {
      await this.sqlite3.exec(this.db, sql)
      return
    }
    return this._withLock(() => this.sqlite3.exec(this.db, sql))
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    return this._withLock(async () => {
      await this.sqlite3.exec(this.db, 'BEGIN')
      this._inTransaction = true
      try {
        await fn()
        await this.sqlite3.exec(this.db, 'COMMIT')
      } catch (e) {
        await this.sqlite3.exec(this.db, 'ROLLBACK')
        throw e
      } finally {
        this._inTransaction = false
      }
    })
  }

  private async _rawQuery<T>(sql: string, params: unknown[]): Promise<T[]> {
    const rows: T[] = []
    for await (const stmt of this.sqlite3.statements(this.db, sql)) {
      if (params.length > 0) {
        this.sqlite3.bind_collection(
          stmt,
          params as Parameters<SQLiteAPI['bind_collection']>[1],
        )
      }
      let columns: string[] | undefined
      while ((await this.sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
        columns ??= this.sqlite3.column_names(stmt)
        const row: Record<string, unknown> = {}
        for (let i = 0; i < columns.length; i++) {
          row[columns[i]] = this.sqlite3.column(stmt, i)
        }
        rows.push(row as T)
      }
    }
    return rows
  }
}

/**
 * Purge stale journal/WAL blocks from IDB before SQLite opens the database.
 * IDBBatchAtomicVFS.xDelete fires the IDB delete without awaiting — if the
 * page reloads before the IDB transaction commits, journal blocks persist.
 * SQLite then finds them on next open, tries to read them, and the WASM
 * crashes with "memory access out of bounds" (uncatchable).
 * Cleaning IDB directly avoids the WASM entirely.
 */
function purgeJournalBlocks(dbName: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const req = indexedDB.open(dbName)
    req.onerror = () => resolve()
    req.onupgradeneeded = () => {
      // Fresh database — nothing to purge; abort upgrade so we don't
      // accidentally create the store with the wrong schema.
      req.transaction?.abort()
      resolve()
    }
    req.onsuccess = () => {
      const idb = req.result
      if (!idb.objectStoreNames.contains('blocks')) {
        idb.close()
        return resolve()
      }
      const path = `/${dbName}`
      const tx = idb.transaction(['blocks'], 'readwrite')
      const store = tx.objectStore('blocks')
      // Same range format as IDBBatchAtomicVFS.xDelete
      store.delete(
        IDBKeyRange.bound([`${path}-journal`], [`${path}-journal`, []]),
      )
      store.delete(IDBKeyRange.bound([`${path}-wal`], [`${path}-wal`, []]))
      tx.oncomplete = () => {
        idb.close()
        resolve()
      }
      tx.onerror = () => {
        idb.close()
        resolve()
      }
    }
  })
}

/**
 * Should be called just once.
 * @param dbName
 * @returns
 */
export async function initDbAdapter(dbName: string = DB_NAME): Promise<void> {
  if (dbInitializing) {
    logger.debug('database waiting for init...')
    while (dbInitializing) {
      await sleep(500)
    }

    if (dbInitialized) {
      logger.debug('databate initialized')
      return
    }
  }
  dbInitializing = true
  logger.debug('database initializing...')

  try {
    // Remove any stale journal/WAL blocks left by a previous bad run before
    // SQLite opens the database.  This must happen before vfs_register so that
    // SQLite never sees a hot journal it can't read.
    await purgeJournalBlocks(dbName)

    const module = await SQLiteAsyncESMFactory()
    const sqlite3 = SQLite.Factory(module)

    const vfs = new IDBBatchAtomicVFS(dbName)
    sqlite3.vfs_register(vfs, true)

    const db = await sqlite3.open_v2(dbName)
    adapter = new WaSqliteAdapter(sqlite3, db)
    // Keep rollback journals in RAM so IDBBatchAtomicVFS never writes journal
    // blocks to IndexedDB.  With the default DELETE mode SQLite calls xOpen/
    // xWrite/xDelete on the journal file; xDelete is fire-and-forget in
    // IDBBatchAtomicVFS, so blocks linger in IDB just long enough for a
    // concurrent xAccess (from React StrictMode's double-invoked read effects)
    // to see a hot journal and crash with "file not found".  MEMORY mode
    // eliminates the race entirely — xAccess can never find a journal in IDB.
    await adapter.exec('PRAGMA journal_mode=MEMORY')
    // Run schema in autocommit mode (no explicit BEGIN/COMMIT) so SQLite uses
    // IDBBatchAtomicVFS's batch-atomic-write path (SQLITE_FCNTL_BEGIN_ATOMIC_WRITE)
    // for each DDL statement.
    await adapter.exec(SCHEMA_SQL)
    dbInitialized = true
    logger.debug('database init done.')
  } finally {
    dbInitializing = false
  }
}
