"use client";

import { useMemo } from "react";

/**
 * Code-built cinematic artwork (style.md §13 fallback): layered gradients,
 * two celestial bodies, deterministic star field, ridge silhouettes, grain.
 * Ships day one; replaceable by a commissioned image without layout change.
 */
export function LoginArtwork() {
  // deterministic pseudo-random stars (no hydration mismatch)
  const stars = useMemo(() => {
    const list: Array<{ x: number; y: number; r: number; o: number }> = [];
    let seed = 42;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 90; i++) {
      list.push({
        x: rand() * 100,
        y: rand() * 62,
        r: rand() < 0.85 ? 0.8 : 1.6,
        o: 0.25 + rand() * 0.6,
      });
    }
    return list;
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-art-navy" aria-hidden>
      {/* sky */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_75%_10%,var(--art-navy-2)_0%,var(--art-navy)_55%)]" />
      {/* brand-purple atmosphere glow */}
      <div className="absolute inset-x-0 bottom-[26%] h-[45%] bg-[radial-gradient(70%_100%_at_50%_100%,rgba(108,99,255,0.28)_0%,transparent_70%)]" />
      {/* warm copper horizon */}
      <div className="absolute inset-x-0 bottom-[24%] h-[22%] bg-[radial-gradient(60%_100%_at_35%_100%,rgba(255,138,92,0.35)_0%,transparent_75%)]" />

      {/* stars */}
      <svg className="absolute inset-0 h-full w-full" role="presentation">
        {stars.map((star, i) => (
          <circle
            key={i}
            cx={`${star.x}%`}
            cy={`${star.y}%`}
            r={star.r}
            fill="white"
            opacity={star.o}
          />
        ))}
      </svg>

      {/* large planet, upper third */}
      <div className="absolute right-[12%] top-[10%] h-44 w-44 rounded-full bg-[radial-gradient(circle_at_32%_30%,#8B84FF_0%,#35609f_45%,#2A2560_100%)] opacity-90 shadow-[0_0_80px_rgba(108,99,255,0.45)]" />
      {/* small copper moon */}
      <div className="absolute left-[18%] top-[30%] h-10 w-10 rounded-full bg-[radial-gradient(circle_at_35%_30%,#FFC9AC_0%,var(--art-copper)_55%,#7A3A20_100%)] opacity-85 shadow-[0_0_32px_rgba(255,138,92,0.5)]" />

      {/* ridge silhouettes (three depth layers) */}
      <svg className="absolute inset-x-0 bottom-0 h-[42%] w-full" viewBox="0 0 100 42" preserveAspectRatio="none" role="presentation">
        <path d="M0,22 L12,14 L22,20 L34,10 L46,19 L58,12 L70,21 L82,15 L100,23 L100,42 L0,42 Z" fill="#1B2140" opacity="0.85" />
        <path d="M0,28 L15,21 L28,27 L42,18 L55,26 L68,20 L84,28 L100,22 L100,42 L0,42 Z" fill="#141830" opacity="0.95" />
        <path d="M0,34 L18,28 L36,33 L52,27 L70,33 L88,29 L100,33 L100,42 L0,42 Z" fill="#0C0E1A" />
      </svg>

      {/* subtle grain */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
