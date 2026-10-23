"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { AccessoryId, PetMood, PetStage } from "@/lib/pet";

const STAGE_SCALE: Record<PetStage, number> = {
  bayi: 0.8,
  kecil: 0.88,
  remaja: 0.96,
  dewasa: 1.04,
};

const MOOD_ANIMATION: Record<PetMood, string> = {
  kenyang: "motion-safe:animate-[pet-bounce_1.6s_ease-in-out_infinite]",
  lapar: "motion-safe:animate-[pet-wobble_2.4s_ease-in-out_infinite]",
  sedih: "",
  tidur: "motion-safe:animate-[pet-breathe_3.2s_ease-in-out_infinite]",
};

/**
 * "Saku", the household pet: a round mint creature whose face follows its
 * mood. Colours are fixed (not theme tokens) so it reads the same on light and
 * dark surfaces.
 */
export function PetAvatar({
  mood,
  stage,
  accessory,
  className,
}: {
  mood: PetMood;
  stage: PetStage;
  accessory?: AccessoryId | null;
  className?: string;
}) {
  const uid = React.useId().replace(/:/g, "");
  const body = `pet-body-${uid}`;
  const scale = STAGE_SCALE[stage];

  return (
    <svg viewBox="0 0 120 120" className={cn("overflow-visible", className)} role="img" aria-label={`Saku sedang ${mood}`}>
      <defs>
        <radialGradient id={body} cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor={mood === "sedih" || mood === "tidur" ? "#a7d8c5" : "#8ff0c8"} />
          <stop offset="100%" stopColor={mood === "sedih" || mood === "tidur" ? "#5fa58b" : "#22b07d"} />
        </radialGradient>
      </defs>

      <ellipse cx="60" cy="110" rx={30 * scale} ry="5" fill="#000" opacity="0.12" />

      <g
        className={cn("origin-[60px_108px]", MOOD_ANIMATION[mood])}
        style={{ transformBox: "view-box" }}
      >
        <g transform={`translate(60 108) scale(${scale}) translate(-60 -108)`}>
          {/* Ears */}
          <path d="M30 44 L34 16 L54 34 Z" fill={`url(#${body})`} stroke="#14805a" strokeWidth="2" strokeLinejoin="round" />
          <path d="M90 44 L86 16 L66 34 Z" fill={`url(#${body})`} stroke="#14805a" strokeWidth="2" strokeLinejoin="round" />
          <path d="M36 36 L37.5 24 L46 32 Z" fill="#ffb3c7" />
          <path d="M84 36 L82.5 24 L74 32 Z" fill="#ffb3c7" />

          {/* Body */}
          <circle cx="60" cy="66" r="42" fill={`url(#${body})`} stroke="#14805a" strokeWidth="2" />
          <ellipse cx="60" cy="84" rx="24" ry="18" fill="#ffffff" opacity="0.35" />
          {/* Coin slot — Saku is a piggy-bank at heart */}
          <rect x="52" y="27" width="16" height="4" rx="2" fill="#14805a" opacity="0.55" />

          {/* Cheeks */}
          <ellipse cx="36" cy="72" rx="7" ry="4.5" fill="#ff8fab" opacity={mood === "kenyang" ? 0.75 : 0.4} />
          <ellipse cx="84" cy="72" rx="7" ry="4.5" fill="#ff8fab" opacity={mood === "kenyang" ? 0.75 : 0.4} />

          <Face mood={mood} />

          {accessory && <Accessory id={accessory} />}
        </g>
      </g>

      {mood === "tidur" && (
        <g fill="#7c8a99" fontWeight="700" fontFamily="inherit">
          <text x="92" y="28" fontSize="12" className="motion-safe:animate-pulse">z</text>
          <text x="101" y="17" fontSize="9" className="motion-safe:animate-pulse">z</text>
        </g>
      )}
    </svg>
  );
}

function Face({ mood }: { mood: PetMood }) {
  const ink = "#1f2d27";
  switch (mood) {
    case "kenyang":
      return (
        <g stroke={ink} strokeWidth="3.5" strokeLinecap="round" fill="none">
          <path d="M40 60 Q46 52 52 60" />
          <path d="M68 60 Q74 52 80 60" />
          <path d="M48 74 Q60 88 72 74" fill="#e8505b" stroke={ink} strokeWidth="3" />
        </g>
      );
    case "lapar":
      return (
        <g>
          <circle cx="46" cy="60" r="5.5" fill={ink} />
          <circle cx="74" cy="60" r="5.5" fill={ink} />
          <circle cx="48" cy="58" r="1.8" fill="#fff" />
          <circle cx="76" cy="58" r="1.8" fill="#fff" />
          <ellipse cx="60" cy="79" rx="5" ry="6" fill="#e8505b" stroke={ink} strokeWidth="2.5" />
        </g>
      );
    case "sedih":
      return (
        <g stroke={ink} strokeLinecap="round" fill="none">
          <path d="M38 52 L50 56" strokeWidth="3" />
          <path d="M82 52 L70 56" strokeWidth="3" />
          <circle cx="46" cy="62" r="4.5" fill={ink} stroke="none" />
          <circle cx="74" cy="62" r="4.5" fill={ink} stroke="none" />
          <path d="M50 82 Q60 74 70 82" strokeWidth="3" />
          <path d="M80 68 q3 6 0 9 q-3 -3 0 -9z" fill="#5bc0f8" stroke="none" />
        </g>
      );
    case "tidur":
      return (
        <g stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M40 61 Q46 65 52 61" />
          <path d="M68 61 Q74 65 80 61" />
          <path d="M55 79 L65 79" />
        </g>
      );
  }
}

function Accessory({ id }: { id: AccessoryId }) {
  switch (id) {
    case "syal":
      return (
        <g>
          <path d="M22 92 Q60 112 98 92 L96 102 Q60 120 24 102 Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" strokeLinejoin="round" />
          <path d="M74 104 L80 122 L90 118 L84 101 Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="2" strokeLinejoin="round" />
          <path d="M40 101 L44 107 M56 104 L58 110 M72 103 L72 109" stroke="#fde68a" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      );
    case "topi":
      return (
        <g transform="rotate(-14 60 20)">
          <path d="M44 30 L60 -6 L76 30 Z" fill="#8b5cf6" stroke="#5b21b6" strokeWidth="2" strokeLinejoin="round" />
          <path d="M50 18 L70 18 M47 25 L73 25" stroke="#fde047" strokeWidth="3" />
          <circle cx="60" cy="-7" r="5" fill="#fb7185" stroke="#be123c" strokeWidth="1.5" />
        </g>
      );
    case "kacamata":
      return (
        <g fill="#0f172a" fillOpacity="0.85" stroke="#0f172a" strokeWidth="2.5">
          <rect x="33" y="52" width="24" height="16" rx="7" />
          <rect x="63" y="52" width="24" height="16" rx="7" />
          <path d="M57 58 L63 58" fill="none" />
          <path d="M37 56 L44 56" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
          <path d="M67 56 L74 56" stroke="#fff" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "mahkota":
      return (
        <g>
          <path d="M38 30 L42 8 L52 20 L60 4 L68 20 L78 8 L82 30 Z" fill="#fbbf24" stroke="#b45309" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="60" cy="22" r="3.5" fill="#ef4444" />
          <circle cx="47" cy="25" r="2.5" fill="#3b82f6" />
          <circle cx="73" cy="25" r="2.5" fill="#3b82f6" />
        </g>
      );
  }
}
