"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import clsx from "clsx";
import { ArrowRight } from "@/components/ui/icons";
import { fmtNum2 } from "@/lib/format";

const num = (v: string) => { const n = parseFloat(v.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };

/** Start kalkulačky přímo v hero: metry hned, otázky až na další stránce. */
export function HeroStart({ cta, className }: { cta: string; className?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"dims" | "area">("dims");
  const [l, setL] = useState("");
  const [w, setW] = useState("");
  const [a, setA] = useState("");
  const lRef = useRef<HTMLInputElement>(null);
  const wRef = useRef<HTMLInputElement>(null);
  const aRef = useRef<HTMLInputElement>(null);
  const area = mode === "dims" ? (num(l) && num(w) ? num(l)! * num(w)! : null) : num(a);

  return (
    <form
      className={clsx("text-ink text-left mx-auto max-w-2xl bg-white/95 backdrop-blur rounded-lg shadow-card p-4 sm:p-5", className)}
      onSubmit={(e) => {
        e.preventDefault();
        // Tlačítko není nikdy šedé — při nevyplněném poli jen skočíme do něj.
        if (!area) { (mode === "area" ? aRef : !num(l) ? lRef : wRef).current?.focus(); return; }
        const q = mode === "dims" ? `l=${encodeURIComponent(l.replace(",", "."))}&w=${encodeURIComponent(w.replace(",", "."))}` : `area=${encodeURIComponent(a.replace(",", "."))}`;
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
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        {mode === "dims" ? (<>
          <label className="block"><span className="label">Délka (m)</span><input ref={lRef} inputMode="decimal" enterKeyHint="next" className="input text-xl" placeholder="5,2" value={l} onChange={(e) => setL(e.target.value)} /></label>
          <label className="block"><span className="label">Šířka (m)</span><input ref={wRef} inputMode="decimal" enterKeyHint="go" className="input text-xl" placeholder="3,8" value={w} onChange={(e) => setW(e.target.value)} /></label>
        </>) : (
          <label className="block col-span-2"><span className="label">Plocha (m²)</span><input ref={aRef} inputMode="decimal" enterKeyHint="go" className="input text-xl" placeholder="19,76" value={a} onChange={(e) => setA(e.target.value)} /></label>
        )}
        <button type="submit" className="btn btn-accent h-[3.05rem] px-5 col-span-2 sm:col-span-1">{cta} <ArrowRight className="h-5 w-5" /></button>
      </div>
      <p className="text-xs text-muted mt-2.5">{area ? <>{fmtNum2(area)} m² · ještě 3 otázky a uvidíte cenu projektu.</> : "Další místnosti přidáte později."}</p>
    </form>
  );
}
