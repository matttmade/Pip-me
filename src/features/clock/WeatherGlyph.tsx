import { wmoGlyph } from '../weather/wmo'

// Original line icons drawn for this project (24×24, phosphor stroke).
const CLOUD = 'M7 18h10.5a3.8 3.8 0 0 0 .3-7.6A5.6 5.6 0 0 0 7 11.2 3.4 3.4 0 0 0 7 18z'
const CLOUD_HI = 'M7 14h10.5a3.6 3.6 0 0 0 .3-7.2A5.4 5.4 0 0 0 7 7.4 3.3 3.3 0 0 0 7 14z'

function Sun({ cx = 12, cy = 12, r = 4, ray = 3 }: { cx?: number; cy?: number; r?: number; ray?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const x1 = cx + Math.cos(a) * (r + 2)
    const y1 = cy + Math.sin(a) * (r + 2)
    return <line key={i} x1={x1} y1={y1} x2={x1 + Math.cos(a) * ray} y2={y1 + Math.sin(a) * ray} />
  })
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} />
      {rays}
    </g>
  )
}

const Moon = () => <path d="M15.5 4.5a7.5 7.5 0 1 0 4 12.6A6.2 6.2 0 0 1 15.5 4.5z" />

/** A WMO weather code as a small original glyph. `night` swaps the sun for a crescent. */
export function WeatherGlyph({ code, night = false, size = 28 }: { code: number; night?: boolean; size?: number }) {
  const g = wmoGlyph(code)
  let body
  switch (g) {
    case 'clear':
      body = night ? <Moon /> : <Sun />
      break
    case 'partly':
      body = (
        <>
          {night ? (
            <path d="M10 3.2a4.6 4.6 0 1 0 4.4 6.1A3.8 3.8 0 0 1 10 3.2z" />
          ) : (
            <Sun cx={9} cy={8} r={3} ray={2} />
          )}
          <path d={CLOUD} className="wg-fill" />
        </>
      )
      break
    case 'cloud':
      body = <path d={CLOUD} />
      break
    case 'fog':
      body = (
        <>
          <path d={CLOUD_HI} />
          <path d="M4 17h16M6 20.5h12" />
        </>
      )
      break
    case 'drizzle':
      body = (
        <>
          <path d={CLOUD_HI} />
          <path d="M8 17.5v.5M12 18.5v.5M16 17.5v.5M10 21v.5M14 21v.5" strokeLinecap="round" />
        </>
      )
      break
    case 'rain':
      body = (
        <>
          <path d={CLOUD_HI} />
          <path d="M8.5 16.5l-1.5 4M12.5 16.5l-1.5 4M16.5 16.5l-1.5 4" />
        </>
      )
      break
    case 'snow':
      body = (
        <>
          <path d={CLOUD_HI} />
          <path d="M8 17v4M6.3 19h3.4M15 17v4M13.3 19h3.4M11.5 20.5v2M10.6 21.5h1.8" />
        </>
      )
      break
    case 'storm':
      body = (
        <>
          <path d={CLOUD_HI} />
          <path d="M12.5 14l-2.5 4.2h3l-2 4.3" />
        </>
      )
      break
    default:
      body = (
        <>
          <path d={CLOUD_HI} strokeDasharray="2 2" />
          <path d="M10.4 17.6a1.7 1.7 0 1 1 2.3 1.6c-.5.2-.7.6-.7 1.1M12 22.2v.3" strokeLinecap="round" />
        </>
      )
  }
  return (
    <svg className="wglyph" viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      {body}
    </svg>
  )
}
