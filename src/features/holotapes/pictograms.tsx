/** Original line pictograms for INV item types. Stroke-only, currentColor, 48x48 grid. */

export type PictId = 'holotape' | 'terminal' | 'aid' | 'focus' | 'countdown' | 'stopwatch' | 'convert' | 'calc' | 'note'

const PATHS: Record<PictId, React.ReactNode> = {
  holotape: (
    <>
      <rect x="5" y="11" width="38" height="26" rx="2" />
      <rect x="11" y="16" width="26" height="11" />
      <circle cx="18" cy="21.5" r="3" />
      <circle cx="30" cy="21.5" r="3" />
      <path d="M21 21.5h6M13 37l3-5h16l3 5" />
    </>
  ),
  terminal: (
    <>
      <rect x="7" y="7" width="34" height="25" rx="2" />
      <path d="M13 15l5 4-5 4M21 24h8M16 32l-3 6h22l-3-6M9 42h30" />
    </>
  ),
  aid: (
    <>
      <path d="M10 38l6-6M14 26l8 8M18 22l14-14 8 8-14 14z" />
      <path d="M28 12l8 8M36 6l6 6M39 9l-4 4" />
      <path d="M22 22l3 3M26 18l3 3" />
    </>
  ),
  focus: (
    <>
      <path d="M12 6h24M12 42h24M15 6c0 10 9 13 9 18s-9 8-9 18M33 6c0 10-9 13-9 18s9 8 9 18" />
      <path d="M19 37l5-4 5 4z" />
      <path d="M20 14h8" />
    </>
  ),
  countdown: (
    <>
      <circle cx="24" cy="26" r="14" />
      <path d="M24 17v9l6 4M8 12l7-6M40 12l-7-6M14 42l3-4M34 42l-3-4" />
    </>
  ),
  stopwatch: (
    <>
      <circle cx="24" cy="27" r="15" />
      <path d="M20 6h8M24 6v6M36 13l3-3M24 27l7-7" />
      <path d="M24 15v2M36 27h-2M24 39v-2M12 27h2" />
    </>
  ),
  convert: (
    <>
      <path d="M24 7v34M14 41h20M10 13h28" />
      <path d="M10 13l-6 13h12zM38 13l-6 13h12z" />
      <path d="M4 26c1 4 11 4 12 0M32 26c1 4 11 4 12 0" />
    </>
  ),
  calc: (
    <>
      <rect x="10" y="5" width="28" height="38" rx="2" />
      <rect x="15" y="10" width="18" height="8" />
      <path d="M16 25h2M23 25h2M30 25h2M16 31h2M23 31h2M30 31h2M16 37h2M23 37h2M30 31v6" />
    </>
  ),
  note: (
    <>
      <path d="M10 5h20l8 8v30H10z" />
      <path d="M30 5v8h8M15 20h18M15 26h18M15 32h12" />
    </>
  ),
}

export function Pictogram({ id }: { id: PictId }) {
  return (
    <svg className="inv-pict" viewBox="0 0 48 48" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" strokeLinejoin="miter">
      {PATHS[id]}
    </svg>
  )
}
