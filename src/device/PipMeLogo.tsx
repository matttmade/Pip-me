type Props = { variant?: 'emboss' | 'phosphor' | 'outline' | 'halftone'; tagline?: boolean; className?: string }

/**
 * Original "Pip-Me" wordmark: heavy slab italic with the hyphen stretched into a speed bar
 * and trailing speed lines. A riff on the spirit of the Pip-Boy mark, not a copy of it.
 */
export function PipMeLogo({ variant = 'phosphor', tagline = false, className = '' }: Props) {
  return (
    <span className={`pipme-logo pipme-logo--${variant} ${className}`} role="img" aria-label="Pip-Me">
      <span className="pipme-logo__word" aria-hidden>
        <span>Pip</span>
        <span className="pipme-logo__dash" />
        <span>Me</span>
        <span className="pipme-logo__speed">
          <i />
          <i />
          <i />
        </span>
      </span>
      {tagline && <span className="pipme-logo__tagline">PERSONAL INFORMATION PROCESSOR</span>}
    </span>
  )
}
