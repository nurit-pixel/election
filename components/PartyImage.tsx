"use client";

import { useState } from "react";
import { caricatureSrc, placeholderSrc } from "@/lib/parties";

// מציג /caricatures/<key>.png, ואם אין עדיין איור — את ה-placeholder ב-SVG
export default function PartyImage({ partyKey, size, alt = "" }: { partyKey: string; size: number; alt?: string }) {
  const [src, setSrc] = useState(caricatureSrc(partyKey));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      onError={() => src !== placeholderSrc(partyKey) && setSrc(placeholderSrc(partyKey))}
      className="shrink-0 select-none"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
