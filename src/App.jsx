import { Routes, Route } from 'react-router-dom'
import { Suspense } from 'react'
import Home from './pages/Home.jsx'
import AppletShell from './components/AppletShell.jsx'
import applets from './applets/registry.js'

export default function App() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        {applets.map((applet) => (
          <Route
            key={applet.slug}
            path={`/applets/${applet.slug}`}
            element={
              <AppletShell title={applet.title} subtitle={applet.subtitle} tags={applet.tags}>
                <applet.component />
              </AppletShell>
            }
          />
        ))}
      </Routes>
    </Suspense>
  )
}
