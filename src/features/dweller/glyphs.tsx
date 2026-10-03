import type { ReactNode } from 'react'
import type { Gesture } from './vaultboy/behavior'
import type { ReadoutId } from './statusReadouts'
import type { WeaponId } from './weapons'

/** Original line-art glyphs for the STATUS emote buttons and readout boxes (24×24). */
function Glyph({ children, className = 'st-glyph' }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      {children}
    </svg>
  )
}

const head = <circle cx="12" cy="4.6" r="2.3" />

const EMOTE_GLYPH: Record<Gesture, ReactNode> = {
  // open hand with motion ticks
  wave: (
    <path d="M8 13V6.5a1.4 1.4 0 012.8 0V11 M10.8 10.5V4.8a1.4 1.4 0 012.8 0v5.7 M13.6 10.5V5.8a1.4 1.4 0 012.8 0v6.4 M16.4 12V9.6a1.4 1.4 0 012.8 0v4.1c0 4.3-2.7 7.3-6.6 7.3-2.7 0-4.4-1.4-5.7-3.4L4.4 13.4a1.4 1.4 0 012.3-1.6L8 13.5 M3 7.5c.2-1.6 1-2.8 2.2-3.6 M21 4.5c.9.9 1.4 2 1.4 3.3" />
  ),
  // fist with the thumb up
  thumbsUp: <path d="M3 10.5h3.5V21H3z M6.5 10.5L10.4 3c1.6 0 2.7 1.2 2.3 3l-.9 3.8h5.9a2 2 0 012 2.4l-1.3 6.4A2.3 2.3 0 0116.2 21H6.5" />,
  // bent arm, bicep up
  flex: (
    <path d="M3.5 20.5h11.2c3.5 0 6-2.3 6-5.4 0-2.7-2.1-4.9-4.8-4.9-1.7 0-3 .8-3.9 2l-1.3-3.6 1.8-1.8c.9-.9.4-2.6-1-2.6H8.6L6.2 7.6 7.4 13 3.5 17.5z M13 15.5c.8-1 1.9-1.6 3.1-1.6" />
  ),
  // hand pointing right
  point: <path d="M3 10.5h4l3-3h11a1.5 1.5 0 010 3h-7.5 M13.5 10.5h.5a1.5 1.5 0 010 3h-1 M13 13.5a1.5 1.5 0 010 3h-1 M12 16.5a1.5 1.5 0 010 3H7.5L3 17" />,
  // arms up, little sparks
  cheer: (
    <>
      {head}
      <path d="M12 7.6V15 M12 15l-3.2 6 M12 15l3.2 6 M12 9.5L7 4.5 M12 9.5l5-5 M3.5 8.5l1.6.6 M20.5 8.5l-1.6.6 M4.5 3.5l1.2 1 M19.5 3.5l-1.2 1" />
    </>
  ),
  // akimbo
  handsOnHips: (
    <>
      {head}
      <path d="M12 7.6V15 M12 15l-3.2 6 M12 15l3.2 6 M12 9.2l-4.4 2.4 2.6 3 M12 9.2l4.4 2.4-2.6 3" />
    </>
  ),
}

const READOUT_GLYPH: Record<ReadoutId, ReactNode> = {
  temp: <path d="M10 14.2V5a2 2 0 014 0v9.2a4 4 0 11-4 0z M12 9.5v7 M16.5 6h2 M16.5 9h2" />,
  rads: (
    <path
      className="st-glyph__fill"
      d="M13.7 14.9L16.8 20.2A9.5 9.5 0 0 1 7.3 20.2L10.3 14.9A3.4 3.4 0 0 0 13.7 14.9ZM8.6 12.0L2.5 12.0A9.5 9.5 0 0 1 7.2 3.8L10.3 9.1A3.4 3.4 0 0 0 8.6 12.0ZM13.7 9.1L16.8 3.8A9.5 9.5 0 0 1 21.5 12.0L15.4 12.0A3.4 3.4 0 0 0 13.7 9.1Z M12 10.4a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2z"
    />
  ),
  caps: (
    <path d="M12 2.5l2 2.2 2.9-.6.6 2.9 2.6 1.4-1.1 2.8 1.1 2.8-2.6 1.4-.6 2.9-2.9-.6-2 2.2-2-2.2-2.9.6-.6-2.9-2.6-1.4 1.1-2.8-1.1-2.8 2.6-1.4.6-2.9 2.9.6z M12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z" />
  ),
  quests: <path d="M3.5 6l1.6 1.6L8 4.7 M11 6.3h9.5 M3.5 12l1.6 1.6L8 10.7 M11 12.3h9.5 M4 18.3h3.5 M11 18.3h9.5" />,
}

/** The EMOTES trigger: a grinning face. */
export const EmoteMenuGlyph = () => (
  <Glyph>
    <path d="M12 3a9 9 0 110 18 9 9 0 010-18z M8.2 9.6v1.2 M15.8 9.6v1.2 M7.4 14c1.1 1.9 2.8 2.9 4.6 2.9s3.5-1 4.6-2.9z" />
  </Glyph>
)

export const EmoteGlyph = ({ id }: { id: Gesture }) => <Glyph>{EMOTE_GLYPH[id]}</Glyph>
export const ReadoutGlyph = ({ id }: { id: ReadoutId }) => <Glyph className="readout__icon">{READOUT_GLYPH[id]}</Glyph>

/* ---------- weapon slot pictograms (original line art) ---------- */

const WEAPON_GLYPH: Record<WeaponId, ReactNode> = {
  // a clenched fist, knuckles forward
  fist: (
    <path d="M6 10.2V8.4a1.6 1.6 0 013.2 0v1 M9.2 9.4V7.2a1.6 1.6 0 013.2 0v2.2 M12.4 9.4V7.4a1.6 1.6 0 013.2 0v2.4 M15.6 9.8V8.6a1.6 1.6 0 013.2 0v4.6c0 3.4-2.5 5.9-5.9 5.9h-1.6c-3.1 0-5.5-2.3-5.5-5.3v-1.6 M4 12.2c0-1 .8-1.8 1.8-1.8h4.4a1.6 1.6 0 010 3.2H8 M9.5 19.2V22 M15.5 19V22" />
  ),
  // toy squirt gun: tank on top, stubby nozzle, chunky grip
  water: (
    <>
      <path d="M2.5 9.8h12.8l1.8 1.3h2.4v2.2h-2.4l-1.8 1.1H11l-1.3 6.1H5.9l1-6.1H4.2L2.5 12.6z M7 9.8V6.9A1.7 1.7 0 018.7 5.2h3.6A1.7 1.7 0 0114 6.9v2.9 M9.8 14.4c.3 1.2.9 1.9 1.9 2.1 M7.5 7.6h5" />
      <path className="st-glyph__fill" d="M22 10.4c.7.9 1.1 1.5 1.1 2a1.1 1.1 0 01-2.2 0c0-.5.4-1.1 1.1-2z" />
    </>
  ),
  // a finned mini-nuke with a trefoil band
  nuke: (
    <>
      <path d="M3 12c0-2.9 3.4-4.8 7.8-4.8h3.4l1.6 1.4v6.8l-1.6 1.4h-3.4C6.4 16.8 3 14.9 3 12z M15.8 9.6l3.4-2.8h1.8v10.4h-1.8l-3.4-2.8 M19.2 6.8v10.4 M12.2 7.2v9.6" />
      <path
        className="st-glyph__fill"
        d="M8.3 12a.9.9 0 101.8 0 .9.9 0 10-1.8 0z M8.6 10.4L7.6 8.7a3.3 3.3 0 013.3 0l-1 1.7z M10.8 12.8l1 1.7a3.3 3.3 0 01-1.7 1.4V14z M7.6 12.8v1.9a3.3 3.3 0 01-1.6-1.4l1-1.7z"
      />
    </>
  ),
}

export const WeaponGlyph = ({ id }: { id: WeaponId }) => <Glyph className="weapon__glyph">{WEAPON_GLYPH[id]}</Glyph>

/** Water-drop ammo pip. */
export const DropGlyph = () => (
  <Glyph className="weapon__drop">
    <path className="st-glyph__fill" d="M12 3c3.4 4.3 5.6 7.4 5.6 10.4a5.6 5.6 0 01-11.2 0C6.4 10.4 8.6 7.3 12 3z" />
  </Glyph>
)
