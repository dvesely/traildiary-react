// apps/web/src/application/providers/db-provider.tsx

import { RepositoryProvider } from '@traildiary/ui'
import { type ReactNode, useMemo } from 'react'
import { createRepositories } from '../../infrastructure/di.js'
import { getWaSqliteAdapter } from '../../infrastructure/wa-sqlite-adapter.js'

export function DbProvider({ children }: { children: ReactNode }) {
  // initDbAdapter() is awaited in main.tsx before React renders, so the
  // adapter is always ready here — no async init or useEffect needed.
  const adapter = getWaSqliteAdapter()
  const repositories = useMemo(() => createRepositories(adapter), [adapter])

  return (
    <RepositoryProvider repositories={repositories}>
      {children}
    </RepositoryProvider>
  )
}
