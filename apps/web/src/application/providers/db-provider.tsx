import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PGlite } from '@electric-sql/pglite'
import { getPgliteClient, runMigrations } from '@traildiary/db'
import { RepositoryProvider } from '@traildiary/ui'
import { createRepositories } from '../../infrastructure/di.js'

interface DbContextValue {
  db: PGlite | null
  isReady: boolean
}

const DbContext = createContext<DbContextValue>({ db: null, isReady: false })

export function useDb() {
  const ctx = useContext(DbContext)
  if (!ctx.isReady) throw new Error('Database not ready')
  return ctx.db!
}

export function useDbStatus() {
  return useContext(DbContext)
}

export function DbProvider({ children, migrationSql }: { children: ReactNode; migrationSql: string }) {
  const [state, setState] = useState<DbContextValue>({ db: null, isReady: false })

  useEffect(() => {
    let cancelled = false
    async function init() {
      const client = await getPgliteClient('idb://traildiary')
      await runMigrations(client, migrationSql)
      if (!cancelled) setState({ db: client, isReady: true })
    }
    init()
    return () => { cancelled = true }
  }, [migrationSql])

  const repositories = useMemo(
    () => state.db ? createRepositories(state.db) : null,
    [state.db]
  )

  if (!state.isReady || !repositories) {
    return <DbContext.Provider value={state}>{children}</DbContext.Provider>
  }

  return (
    <DbContext.Provider value={state}>
      <RepositoryProvider repositories={repositories}>
        {children}
      </RepositoryProvider>
    </DbContext.Provider>
  )
}
