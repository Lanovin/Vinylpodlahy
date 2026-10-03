"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import clsx from "clsx";
import { ArrowRight } from "@/components/ui/icons";
import { fmtNum2 } from "@/lib/format";
import { ROOM_CHIP, ROOM_OPTIONS } from "@/lib/guide";
import type { RoomKind } from "@/lib/types";

/** Desetinná čárka i tečka: „5,2“ i „5.2“ = 5,2. */
const num = (v: string) => { const n = parseFloat(v.trim().replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
/** Do pole pustíme jen číslice a jeden oddělovač (čárka/tečka). */
const clean = (v: string) => v.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1");

/** Start kalkulačky přímo v hero: typ místnosti a metry hned, otázky až na další stránce. */
export function HeroStart({ cta, className }: { cta: string; className?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"dims" | "area">("dims");
  const [room, setRoom] = useState<RoomKind | null>(null);
  const [l, setL] = useState("");
  const [w, setW] = useState("");
  const [a, setA] = useState("");
  const lRef = useRef<HTMLInputElement>(null);
  const wRef = useRef<HTMLInputElement>(null);
  const aRef = useRef<HTMLInputElement>(null);
  const area = mode === "dims" ? (num(l) && num(w) ? num(l)! * num(w)! : null) : num(a);
  const inputCls = "input text-xl placeholder:text-muted/60";

  return (
    <form
      className={clsx("text-ink text-left mx-auto max-w-2xl min-w-0 bg-white/95 backdrop-blur rounded-lg shadow-card p-4 sm:p-5", className)}
      onSubmit={(e) => {
        e.preventDefault();
        // Tlačítko není nikdy šedé — při nevyplněném poli jen skočíme do něj.
        if (!area) { (mode === "area" ? aRef : !num(l) ? lRef : wRef).current?.focus(); return; }
        const q = new URLSearchParams(mode === "dims" ? { l: String(num(l)), w: String(num(w)) } : { area: String(num(a)) });
        // Bez zvoleného typu místnosti se kalkulačka na něj zeptá (nedomýšlíme „obývák“).
        if (room) q.set("room", room);
        router.push(`/kalkulacka?${q}`);
      }}
    >
      <div className="flex items-center justify-between gap-x-3 gap-y-2 flex-wrap">
        <p className="text-lg leading-tight">Kolik metrů potřebujete?</p>
        <div className="grid grid-cols-2 w-full sm:w-auto rounded-sm border border-line-strong overflow-hidden text-sm">
          <button type="button" className={clsx("h-10 px-3", mode === "dims" ? "bg-ink text-white" : "bg-white")} onClick={() => setMode("dims")}>Délka × šířka</button>
          <button type="button" className={clsx("h-10 px-3", mode === "area" ? "bg-ink text-white" : "bg-white")} onClick={() => setMode("area")}>Znám plochu</button>
        </div>
      </div>
      {/* Typ místnosti — jedna posuvná řada čipů (grid s minmax(0,1fr), aby řada nenatáhla stránku na 360 px) */}
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)]">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Typ místnosti">
          {ROOM_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={room === o.value} onClick={() => setRoom(room === o.value ? null : o.value)}
              className={clsx("shrink-0 h-11 rounded-full px-4 text-sm border transition-colors", room === o.value ? "bg-ink text-white border-ink" : "bg-white border-line-strong hover:border-ink")}>
              {ROOM_CHIP[o.value]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        {mode === "dims" ? (<>
          <label className="block"><span className="label">Délka (m)</span><input ref={lRef} inputMode="decimal" enterKeyHint="next" autoComplete="off" className={inputCls} placeholder="např. 5,2" value={l} onChange={(e) => setL(clean(e.target.value))} /></label>
          <label className="block"><span className="label">Šířka (m)</span><input ref={wRef} inputMode="decimal" enterKeyHint="go" autoComplete="off" className={inputCls} placeholder="např. 3,8" value={w} onChange={(e) => setW(clean(e.target.value))} /></label>
        </>) : (
          <label className="block col-span-2"><span className="label">Plocha (m²)</span><input ref={aRef} inputMode="decimal" enterKeyHint="go" autoComplete="off" className={inputCls} placeholder="např. 19,8" value={a} onChange={(e) => setA(clean(e.target.value))} /></label>
        )}
        <button type="submit" className="btn btn-accent h-[3.05rem] px-5 col-span-2 sm:col-span-1">{cta} <ArrowRight className="h-5 w-5" /></button>
      </div>
      <p className="text-xs text-muted mt-2.5">{area ? <>{fmtNum2(area)} m² · ještě pár otázek a uvidíte cenu celého projektu.</> : "Další místnosti přidáte později."}</p>
    </form>
  );
}
