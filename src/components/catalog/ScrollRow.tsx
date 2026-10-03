"use client";
import { useEffect, useRef } from "react";

/**
 * Vodorovně posuvná řada čipů: po načtení odscrolluje aktivní čip (`aria-current`) doprostřed,
 * aby nebyl uříznutý u okraje. Posouvá jen řadu, ne stránku.
 */
export function ScrollRow({ className, children, label }: { className?: string; children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    const el = row?.querySelector<HTMLElement>("[aria-current]");
    if (!row || !el || row.scrollWidth <= row.clientWidth + 1) return;
    row.scrollLeft = el.offsetLeft - row.clientWidth / 2 + el.offsetWidth / 2;
  });
  return <nav ref={ref} className={className} aria-label={label}>{children}</nav>;
}
