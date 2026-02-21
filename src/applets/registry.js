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
  {
    slug: 'addition-lockstep',
    title: 'Lockstep Addition',
    subtitle: 'Slide an addend and watch the sum move with it',
    tags: ['addition', 'patterns', 'ages 4-6'],
    component: lazy(() => import('./addition-lockstep/index.jsx')),
  },
  {
    slug: 'addition-dial',
    title: 'Dial Addition',
    subtitle: 'Dial either addend up or down and the sum follows',
    tags: ['addition', 'patterns', 'ages 4-6'],
    component: lazy(() => import('./addition-dial/index.jsx')),
  },
  {
    slug: 'addition-balance',
    title: 'Balance Scale',
    subtitle: 'Drag weights onto trays to balance an addition equation',
    tags: ['addition', 'equality', 'ages 4-6'],
    component: lazy(() => import('./addition-balance/index.jsx')),
  },
  {
    slug: 'addition-handwriting',
    title: 'Handwriting Practice',
    subtitle: 'Write your answer and the browser recognizes your handwriting',
    tags: ['addition', 'handwriting', 'ages 4-6'],
    component: lazy(() => import('./addition-handwriting/index.jsx')),
  },
  {
    slug: 'tile-puzzles',
    title: 'Tile Puzzles',
    component: lazy(() => import('./tile-puzzles/index.jsx')),
  },
]

export default applets
