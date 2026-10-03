import { useProfile } from '../../lib/contracts'
import { figureTap } from './figureTap'

/**
 * 2D fallback Dweller (no WebGL, or the scene failed): layered SVG limbs with a CSS
 * walk cycle. Original line art.
 */
export default function PaperDollFallback() {
  const [profile] = useProfile()

  return (
    // taps go to the equipped weapon (STATUS weapon slot)
    <div className="paper-doll" data-no-swipe onClick={(e) => figureTap({ x: e.clientX, y: e.clientY })}>
      <svg viewBox="0 0 120 230" role="img" aria-label="Your Vault Dweller, walking in place">
        <g className="pd-body">
          {/* back arm + back leg */}
          <g className="pd-limb pd-arm pd-arm--back">
            <path d="M78 58 L84 92 L82 120" />
            <circle cx="82" cy="124" r="5" />
          </g>
          <g className="pd-limb pd-leg pd-leg--back">
            <path d="M68 118 L70 166 L69 206" />
            <path className="pd-boot" d="M62 204 h16 l6 8 h-22 z" />
          </g>
          {/* torso */}
          <path className="pd-torso" d="M44 52 Q60 46 76 52 L80 76 L74 120 H46 L40 76 Z" />
          <path className="pd-trim" d="M60 50 V118 M45 104 H75 M52 50 Q60 56 68 50" />
          <text className="pd-number" x="69" y="66" textAnchor="middle">
            {(profile.vault || '111').slice(0, 3)}
          </text>
          {/* front leg + front arm */}
          <g className="pd-limb pd-leg pd-leg--front">
            <path d="M52 118 L50 166 L51 206" />
            <path className="pd-boot" d="M44 204 h16 l6 8 h-22 z" />
          </g>
          <g className="pd-limb pd-arm pd-arm--front">
            <path d="M42 58 L36 92 L38 120" />
            <circle cx="38" cy="124" r="5" />
          </g>
          {/* head slot */}
          <g className="pd-head">
            <circle cx="60" cy="28" r="17" className="pd-face" />
            <path className="pd-hair" d="M43 26 Q44 8 60 9 Q76 8 77 26 Q70 16 60 17 Q50 16 43 26 Z" />
            <path className="pd-features" d="M53 28 h3 M64 28 h3 M60 30 v4 M55 38 Q60 41 65 38" />
            <circle cx="60" cy="28" r="19" className="pd-head-ring" />
          </g>
        </g>
      </svg>
    </div>
  )
}
