"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { Info } from "./icons";
import { TERMS, type TermId } from "./terms";

const W = 272; // šířka bubliny (px)
const GAP = 8;
const EDGE = 12;

/**
 * Vysvětlení pojmu: ťuknutím / kliknutím (nejen hover — funguje i na dotyku) otevře krátkou bublinu.
 * Bez `children` jen ikonka ⓘ; s `children` je text podtržený tečkami a celý klikací.
 * Bublina je v portálu s pevnou pozicí — neořízne ji posuvný panel filtrů ani tabulka.
 */
export function Term({ id, children, className }: { id: TermId; children?: React.ReactNode; className?: string }) {
  const t = TERMS[id];
  const uid = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
  const open = pos !== null;

  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const w = Math.min(W, vw - 2 * EDGE);
    const left = Math.max(EDGE, Math.min(r.left + r.width / 2 - w / 2, vw - w - EDGE));
    const above = r.bottom + 140 > window.innerHeight && r.top > 160;
    setPos({ left, top: above ? r.top - GAP : r.bottom + GAP, above });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDown = (e: PointerEvent) => { if (!btn.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={open ? uid : undefined}
        aria-label={children ? undefined : `Co je ${t.title.toLowerCase()}?`}
        // Uvnitř <label> (filtry) nesmí klik přepnout zaškrtávátko.
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (open) setPos(null); else show(); }}
        className={clsx(
          "inline-flex items-center align-middle text-left",
          children
            ? "gap-1 underline decoration-dotted decoration-line-strong underline-offset-4 hover:decoration-ink"
            : "justify-center h-7 w-7 -my-1.5 rounded-full text-muted hover:text-ink",
          className,
        )}
      >
        {children}
        {!children && <Info className="h-4 w-4" />}
      </button>
      {open && createPortal(
        <div
          id={uid}
          role="tooltip"
          className="fixed z-[90] rounded-md bg-ink text-white px-3.5 py-2.5 text-sm leading-snug shadow-card normal-case tracking-normal"
          style={{ left: pos.left, top: pos.top, width: Math.min(W, window.innerWidth - 2 * EDGE), transform: pos.above ? "translateY(-100%)" : undefined }}
        >
          <p className="font-medium">{t.title}</p>
          <p className="text-white/85 mt-0.5">{t.text}</p>
        </div>,
        document.body,
      )}
    </>
  );
}
