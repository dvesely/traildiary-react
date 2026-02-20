const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch all packages in the monorepo
config.watchFolders = [workspaceRoot]

// Resolve workspace packages from both node_modules locations
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Force React singleton across the monorepo.
  // pnpm installs a separate React copy inside packages/ui/node_modules (for
  // testing), so Metro's hierarchical lookup finds it before the app's copy,
  // creating two React instances → "Objects are not valid as a React child".
  // Fix: pretend any react/react-native import originates from the project root
  // so Metro resolves it from apps/mobile/node_modules instead.
  if (
    moduleName === 'react' ||
    moduleName.startsWith('react/') ||
    moduleName === 'react-native' ||
    moduleName.startsWith('react-native/')
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: path.resolve(projectRoot, '_entry_.js') },
      moduleName,
      platform,
    )
  }

  // TypeScript workspace packages use `.js` extensions (ESM convention).
  // Redirect e.g. `./foo.js` → `./foo.tsx` or `./foo.ts` when the source exists.
  if (moduleName.endsWith('.js')) {
    const base = moduleName.slice(0, -3)
    if (base.startsWith('.') || base.startsWith('/')) {
      const origin = path.dirname(context.originModulePath)
      for (const ext of ['.tsx', '.ts']) {
        const candidate = path.resolve(origin, base + ext)
        if (fs.existsSync(candidate)) {
          return { type: 'sourceFile', filePath: candidate }
        }
      }
    }
  }

  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
