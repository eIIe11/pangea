import { useMemo } from 'react'
import face from '../assets/coin-face.webp'

interface CoinProps {
  size?: number
  spin?: boolean
  className?: string
}

// A minted coin is a cylinder: two faces and a rim. CSS has no curved surfaces, so the rim is
// approximated by slabs stood on edge around the circumference, each shaded by its angle to a
// fixed light. Cheap enough to run at 22px in the header and still read as solid at 160px.
const RIM_SEGMENTS = 44
const LIGHT_DEG = 135

export function Coin({ size = 96, spin = true, className = '' }: CoinProps) {
  const radius = size / 2
  const thickness = Math.max(3, Math.round(size * 0.1))

  const rim = useMemo(() => {
    const slabHeight = (2 * Math.PI * radius) / RIM_SEGMENTS + 1.5
    return Array.from({ length: RIM_SEGMENTS }, (_, i) => {
      const angle = (360 / RIM_SEGMENTS) * i
      const lit = Math.max(0, Math.cos(((angle - LIGHT_DEG) * Math.PI) / 180))
      const shade = 0.4 + 0.6 * lit
      return {
        angle,
        slabHeight,
        color: `rgb(${Math.round(74 * shade + 8)} ${Math.round(88 * shade + 10)} ${Math.round(90 * shade + 10)})`,
      }
    })
  }, [radius])

  return (
    <div
      className={`relative grid place-items-center ${className}`}
      style={{ width: size, height: size, perspective: size * 6 }}
    >
      <div
        aria-hidden
        className="absolute rounded-[50%] bg-pg-accent/12 blur-2xl"
        style={{ width: size * 0.9, height: size * 0.9 }}
      />
      <div
        role="img"
        aria-label="Pangea"
        className={spin ? 'animate-coin' : ''}
        style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
      >
        {rim.map(({ angle, slabHeight, color }) => (
          <div
            key={angle}
            aria-hidden
            className="absolute top-1/2 left-1/2"
            style={{
              width: thickness,
              height: slabHeight,
              background: color,
              transform: `translate(-50%, -50%) rotateZ(${angle}deg) translateX(${radius - 0.5}px) rotateY(90deg)`,
            }}
          />
        ))}
        <img
          src={face}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className="absolute inset-0 select-none"
          style={{
            width: size,
            height: size,
            transform: `translateZ(${thickness / 2}px)`,
            filter: 'brightness(0.92)',
          }}
        />
        <img
          src={face}
          alt=""
          width={size}
          height={size}
          draggable={false}
          className="absolute inset-0 -scale-x-100 select-none"
          style={{
            width: size,
            height: size,
            transform: `rotateY(180deg) translateZ(${thickness / 2}px)`,
            filter: 'brightness(0.74)',
          }}
        />
      </div>
    </div>
  )
}
