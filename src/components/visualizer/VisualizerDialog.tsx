"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@/components/ui/icons";
import type { RoomVisualizerProps } from "./RoomVisualizer";

const Loading = () => (
  <div className="h-full min-h-[320px] grid place-items-center text-muted">
    <div className="flex flex-col items-center gap-3"><span className="h-8 w-8 rounded-full border-2 border-line-strong border-t-ink animate-spin" /><span className="text-sm">Načítám byt ve 3D…</span></div>
  </div>
);

// three.js (≈ 150 kB gzip) se stáhne až při otevření vizualizace.
const RoomVisualizer = dynamic(() => import("./RoomVisualizer"), { ssr: false, loading: Loading });

export function preloadVisualizer() { void import("./RoomVisualizer"); }

/** Vizualizace vložená do stránky: samostatná /vizualizace, nebo `inline` uvnitř jiného obsahu (kalkulačka). */
export function VisualizerEmbed({ inline = false, ...props }: Omit<RoomVisualizerProps, "variant"> & { inline?: boolean }) {
  return <RoomVisualizer variant={inline ? "inline" : "page"} {...props} />;
}

type DialogProps = Omit<RoomVisualizerProps, "variant"> & { open: boolean; onClose: () => void; title: string; subtitle?: string };

/** Celoobrazovkový dialog s vizualizací (karta produktu, kalkulačka). */
export function VisualizerDialog({ open, onClose, title, subtitle, ...props }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-x-0 top-0 bottom-[var(--cookie-h,0px)] z-[80] bg-bg flex flex-col">
      <div className="flex items-center justify-between gap-3 pl-4 pr-1.5 md:px-6 h-14 border-b border-line shrink-0">
        <div className="min-w-0">
          <p className="leading-tight truncate">{title}</p>
          {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
        </div>
        <button type="button" className="h-11 w-11 md:w-auto md:px-3 md:gap-1.5 inline-flex items-center justify-center rounded-sm hover:bg-ink/5 shrink-0" onClick={onClose} autoFocus aria-label="Zavřít"><X className="h-6 w-6 md:h-5 md:w-5" /><span className="hidden md:inline">Zavřít</span></button>
      </div>
      {/* Bez spodního odsazení na telefonu — lišta s akcí se přilepí ke spodku obrazovky */}
      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden px-3 pt-3 md:px-5 md:pt-5 lg:pb-5">
        <RoomVisualizer variant="dialog" {...props} />
      </div>
    </div>,
    document.body,
  );
}
