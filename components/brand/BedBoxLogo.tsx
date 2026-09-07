// The real TheBedBox logo, pulled directly off thebedbox.in and used as-is -
// unmodified pixels, only cropped and (for dark surfaces) given a white
// backing card so it stays legible. Nothing about the artwork itself changes.
/* eslint-disable @next/next/no-img-element */

export function BedBoxMark({ size = 36 }: { size?: number }) {
  // Just the icon (mint circle + house), background already made
  // transparent - it carries its own mint backdrop, so it reads fine on
  // any surface without further treatment.
  return (
    <img
      src="/brand/icon-mark.png"
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, display: 'block' }}
    />
  )
}

type Props = {
  /** Height in px of the full lockup (icon + wordmark). */
  height?: number
  /** 'light' = sitting directly on a white/light surface, used as-is.
   *  'dark' = sitting on a dark surface, so it's given a small white
   *  backing card for contrast - the logo image itself is untouched. */
  surface?: 'dark' | 'light'
  className?: string
}

// real lockup's natural aspect ratio (trimmed asset is 356x94)
const ASPECT = 356 / 94

export function BedBoxLogo({ height = 32, surface = 'dark', className }: Props) {
  const width = height * ASPECT
  const img = (
    <img
      src="/brand/logo-light.png"
      alt="TheBedBox"
      width={width}
      height={height}
      style={{ width, height, display: 'block' }}
    />
  )

  if (surface === 'light') {
    return <span className={className}>{img}</span>
  }

  // Dark surface: same unmodified logo, on its own small white card.
  const pad = height * 0.28
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: '#ffffff',
        borderRadius: (height + pad) * 0.28,
        padding: `${pad * 0.6}px ${pad}px`,
        boxShadow: '0 6px 20px -8px rgba(0,0,0,0.35)',
      }}
    >
      {img}
    </span>
  )
}
