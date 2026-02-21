/**
 * Central registry of all applets.
 * Each applet is a self-contained, single-page interactive visualization.
 *
 * To add a new applet:
 *   1. Create a folder under src/applets/<slug>/
 *   2. Export a default React component from index.jsx
 *   3. Add an entry here
 */

import { lazy } from 'react'

const applets = [
  {
    slug: 'addition-patterns',
    title: 'Addition Patterns',
    subtitle: 'See how sums change when an addend goes up by one',
    tags: ['addition', 'patterns', 'ages 4-6'],
    component: lazy(() => import('./addition-patterns/index.jsx')),
  },
]

export default applets
