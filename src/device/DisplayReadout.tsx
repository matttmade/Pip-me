import { useEffect, useState } from 'react'

type Readout = { mode: string; viewport: string; screen: string; safe: string; bar: string }

function read(): Readout {
  const standalone =
    window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
  document.body.appendChild(probe)
  const s = getComputedStyle(probe)
  const px = (v: string) => Math.round(parseFloat(v) || 0)
  const safe = [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(px).join(' ')
  probe.remove()
  return {
    mode: standalone ? 'HOME SCREEN' : 'BROWSER',
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    safe,
    bar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute('content')?.toUpperCase() ?? '-',
  }
}

/**
 * DATA > SYSTEM > DEVICE: what the browser reports about the display. Mainly for the iOS
 * Home Screen app, where a short viewport means the install predates the solid status bar.
 */
export function DisplayReadout() {
  const [r, setR] = useState(read)
  useEffect(() => {
    const update = () => setR(read())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  const rows: [string, string][] = [
    ['MODE', r.mode],
    ['VIEWPORT', r.viewport],
    ['SCREEN', r.screen],
    ['SAFE AREA', r.safe],
    ['STATUS BAR', r.bar],
  ]
  return (
    <dl className="display-readout" aria-label="Display readout">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
