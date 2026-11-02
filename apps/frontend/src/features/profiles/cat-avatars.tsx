import { cn } from "@wealthfolio/ui/lib/utils";

import type { Cat } from "./avatar-catalog";

const INK = "#2B2230";
const EYE = "#1E1820";
const BLUSH = "#FF6F9C";

/** Folio fork: a round sitting cat with a nub tail, in the cat's colours. */
export function CatAvatar({ cat, className }: { cat: Cat; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mx-auto block aspect-square w-20 max-w-full overflow-hidden rounded-2xl",
        className,
      )}
      style={{ backgroundColor: cat.background }}
    >
      <svg
        viewBox="0 0 100 100"
        className="block size-full"
        fill="none"
        stroke={INK}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <circle className="profile-cat-tail" cx="84" cy="80" r="6.5" fill={cat.fur} />
        <path d="M24 44 L28 19 Q30 13 35 17 L48 31" fill={cat.fur} />
        <path d="M76 44 L72 19 Q70 13 65 17 L52 31" fill={cat.fur} />
        <path d="M29.5 36 L31 23 L41 31 Z" fill={cat.shade} stroke="none" />
        <path d="M70.5 36 L69 23 L59 31 Z" fill={cat.shade} stroke="none" />
        <path
          d="M50 27 C73 27 86 45 86 65 C86 83 70 91 50 91 C30 91 14 83 14 65 C14 45 27 27 50 27 Z"
          fill={cat.fur}
        />
        <ellipse cx="38" cy="90" rx="7.5" ry="4.5" fill={cat.fur} />
        <ellipse cx="62" cy="90" rx="7.5" ry="4.5" fill={cat.fur} />
        <g fill={BLUSH} fillOpacity={0.45} stroke="none">
          <ellipse cx="30" cy="66" rx="5.5" ry="3.2" />
          <ellipse cx="70" cy="66" rx="5.5" ry="3.2" />
        </g>
        <g className="profile-line-eyes" stroke="none">
          <circle cx="38.5" cy="57" r="4" fill={EYE} />
          <circle cx="61.5" cy="57" r="4" fill={EYE} />
          <circle cx="39.8" cy="55.6" r="1.2" fill="#fff" />
          <circle cx="62.8" cy="55.6" r="1.2" fill="#fff" />
        </g>
        <ellipse cx="50" cy="62.5" rx="2.4" ry="1.7" fill={EYE} stroke="none" />
        <path d="M45 66.5 Q47.5 69.5 50 66.5 Q52.5 69.5 55 66.5" strokeWidth={1.7} />
      </svg>
    </span>
  );
}
