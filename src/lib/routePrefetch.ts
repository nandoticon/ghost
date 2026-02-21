const loaders: Record<string, () => Promise<unknown>> = {
    '/today': () => import('../pages/Today'),
    '/tasks': () => import('../pages/Tasks'),
    '/projects': () => import('../pages/Projects'),
    '/analytics': () => import('../pages/Analytics'),
    '/settings': () => import('../pages/Settings'),
}

const prefetched = new Set<string>()

export function prefetchRoute(path: string) {
    const route = path.startsWith('/') ? path : `/${path}`
    const loader = loaders[route]
    if (!loader || prefetched.has(route)) return
    prefetched.add(route)
    void loader()
}

export function prefetchLikelyRoutes() {
    prefetchRoute('/today')
    prefetchRoute('/tasks')
    prefetchRoute('/projects')
}
