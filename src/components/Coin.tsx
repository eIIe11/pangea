import coin from '../assets/coin-teal.webp'

interface CoinProps {
  size?: number
  spin?: boolean
  className?: string
}

/**
 * The Pangea mark. Motion is confined to the lock screen and the home header —
 * control surfaces stay still (§17 design rules) — and stops entirely under
 * `prefers-reduced-motion`.
 */
export function Coin({ size = 96, spin = true, className = '' }: CoinProps) {
  return (
    <div className={`relative grid place-items-center ${className}`} style={{ width: size, height: size }}>
      <div
        aria-hidden
        className="absolute rounded-[50%] bg-pg-accent/12 blur-2xl"
        style={{ width: size * 0.9, height: size * 0.9 }}
      />
      <img
        src={coin}
        alt="Pangea"
        width={size}
        height={size}
        draggable={false}
        className={spin ? 'animate-coin select-none' : 'select-none'}
        style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
      />
    </div>
  )
}
