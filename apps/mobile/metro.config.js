const { getDefaultConfig } = require('@expo/metro-config')
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

// TypeScript workspace packages import with `.js` extensions (ESM convention).
// Redirect e.g. `./foo.js` → `./foo.tsx` or `./foo.ts` when the .ts file exists.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.endsWith('.js')) {
    const base = moduleName.slice(0, -3)
    // Only remap relative / absolute paths, not bare specifiers
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
