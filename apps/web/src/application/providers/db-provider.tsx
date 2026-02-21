// apps/web/src/application/providers/db-provider.tsx

import type { SqliteAdapter } from '@traildiary/db'
import { SCHEMA_SQL } from '@traildiary/db'
import { RepositoryProvider } from '@traildiary/ui'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { createRepositories } from '../../infrastructure/di.js'
import { createWaSqliteAdapter } from '../../infrastructure/wa-sqlite-adapter.js'

interface State {
  adapter: SqliteAdapter | null
  error: string | null
}

export function DbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ adapter: null, error: null })

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const adapter = await createWaSqliteAdapter()
        // Wrap schema in one transaction → one journal created/deleted instead of one per DDL
        await adapter.exec(`BEGIN;\n${SCHEMA_SQL}\nCOMMIT;`)
        if (!cancelled) setState({ adapter, error: null })
      } catch (e) {
        if (!cancelled) setState({ adapter: null, error: String(e) })
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  const repositories = useMemo(
    () => (state.adapter ? createRepositories(state.adapter) : null),
    [state.adapter],
  )

  if (state.error) {
    return (
      <div style={{ padding: 16, color: 'red' }}>
        Database error: {state.error}
      </div>
    )
  }

  if (!repositories) {
    return <div style={{ padding: 16 }}>Loading database…</div>
  }

  return (
    <RepositoryProvider repositories={repositories}>
      {children}
    </RepositoryProvider>
  )
}
