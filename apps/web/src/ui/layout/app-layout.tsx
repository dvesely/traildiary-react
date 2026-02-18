import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100">
      <header className="h-12 flex items-center px-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold">
          <Link to="/" className="hover:text-gray-300 transition-colors">TrailDiary</Link>
        </h1>
      </header>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
