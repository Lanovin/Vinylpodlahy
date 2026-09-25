"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const area = mode === "dims" ? (num(l) && num(w) ? num(l)! * num(w)! : null) : num(a);

  return (
    <form
      className={clsx("text-ink text-left", className ?? "mx-auto max-w-2xl bg-white/95 backdrop-blur rounded-lg shadow-card p-4 sm:p-5")}
      onSubmit={(e) => {
        e.preventDefault();
        if (!area) return;
        const q = mode === "dims" ? `l=${encodeURIComponent(l.replace(",", "."))}&w=${encodeURIComponent(w.replace(",", "."))}` : `area=${encodeURIComponent(a.replace(",", "."))}`;
        router.push(`/kalkulacka?${q}`);
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-lg">Krok 1 z 5 · Kolik metrů potřebujete?</p>
        <div className="inline-flex rounded-sm border border-line-strong overflow-hidden text-xs">
          <button type="button" className={clsx("px-2.5 py-1.5", mode === "dims" ? "bg-ink text-white" : "bg-white")} onClick={() => setMode("dims")}>Délka × šířka</button>
          <button type="button" className={clsx("px-2.5 py-1.5", mode === "area" ? "bg-ink text-white" : "bg-white")} onClick={() => setMode("area")}>Znám plochu</button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        {mode === "dims" ? (<>
          <label className="block"><span className="label">Délka (m)</span><input inputMode="decimal" className="input text-xl" placeholder="5,2" value={l} onChange={(e) => setL(e.target.value)} /></label>
          <label className="block"><span className="label">Šířka (m)</span><input inputMode="decimal" className="input text-xl" placeholder="3,8" value={w} onChange={(e) => setW(e.target.value)} /></label>
        </>) : (
          <label className="block col-span-2"><span className="label">Plocha (m²)</span><input inputMode="decimal" className="input text-xl" placeholder="19,76" value={a} onChange={(e) => setA(e.target.value)} /></label>
        )}
        <button type="submit" className="btn btn-accent h-[3.05rem] px-4 sm:px-5" disabled={!area}><span className="hidden sm:inline">{cta}</span><ArrowRight className="h-5 w-5" /></button>
      </div>
      <p className="text-xs text-muted mt-2.5">{area ? <>{fmtNum2(area)} m² · dalších 4 otázky a vidíte cenu celého projektu.</> : "Víc místností přidáte v dalším kroku. Zabere to 2 minuty."}</p>
    </form>
  );
}
