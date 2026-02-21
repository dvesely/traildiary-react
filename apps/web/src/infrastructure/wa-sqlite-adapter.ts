// apps/web/src/infrastructure/wa-sqlite-adapter.ts

import type { SqliteAdapter } from '@traildiary/db'
import * as SQLite from 'wa-sqlite'
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs'
import { IDBBatchAtomicVFS } from 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js'

type SQLiteAPI = ReturnType<typeof SQLite.Factory>

class WaSqliteAdapter implements SqliteAdapter {
  constructor(
    private readonly sqlite3: SQLiteAPI,
    private readonly db: number,
  ) {}

  async run(sql: string, params: unknown[] = []): Promise<void> {
    await this._query(sql, params)
  }

  async get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const rows = await this._query<T>(sql, params)
    return rows[0]
  }

  async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this._query<T>(sql, params)
  }

  async exec(sql: string): Promise<void> {
    await this.sqlite3.exec(this.db, sql)
  }

  async transaction(fn: () => Promise<void>): Promise<void> {
    await this.exec('BEGIN')
    try {
      await fn()
      await this.exec('COMMIT')
    } catch (e) {
      await this.exec('ROLLBACK')
      throw e
    }
  }

  private async _query<T>(sql: string, params: unknown[]): Promise<T[]> {
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
 * Module-level Promise singleton.
 * React StrictMode double-invokes effects in development; caching the Promise
 * ensures only one WASM module is loaded and only one database connection is
 * opened, regardless of how many times createWaSqliteAdapter() is called.
 */
let _adapterPromise: Promise<SqliteAdapter> | null = null

export function createWaSqliteAdapter(
  dbName = 'traildiary',
): Promise<SqliteAdapter> {
  if (!_adapterPromise) {
    _adapterPromise = _initAdapter(dbName).catch((err) => {
      _adapterPromise = null
      throw err
    })
  }
  return _adapterPromise
}

async function _initAdapter(dbName: string): Promise<SqliteAdapter> {
  // Remove any stale journal/WAL blocks left by a previous bad run before
  // SQLite opens the database.  This must happen before vfs_register so that
  // SQLite never sees a hot journal it can't read.
  await purgeJournalBlocks(dbName)

  const module = await SQLiteAsyncESMFactory()
  const sqlite3 = SQLite.Factory(module)

  const vfs = new IDBBatchAtomicVFS(dbName)
  sqlite3.vfs_register(vfs, true)

  const db = await sqlite3.open_v2(dbName)
  return new WaSqliteAdapter(sqlite3, db)
}
