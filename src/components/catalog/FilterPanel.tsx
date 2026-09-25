"use client";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import type { CatalogFilters } from "@/lib/catalog";
import { filtersToQuery, PRICE_BANDS } from "@/lib/catalog";
import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LOCK_LABEL } from "@/lib/types";
import type { DecorTone, FloorType, LockType } from "@/lib/types";
import { Filter, X } from "@/components/ui/icons";

export interface Facets {
  type: Record<string, number>;
  lock: Record<string, number>;
  thickness: Record<string, number>;
  wear: Record<string, number>;
  usage: Record<string, number>;
  tone: Record<string, number>;
}


function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
  <fieldset className="py-4 border-b border-line last:border-0"><legend className="eyebrow mb-3">{title}</legend><div className="space-y-1.5">{children}</div></fieldset>
);
}
function Opt({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
  <label className={clsx("check text-[0.95rem] w-full justify-between", count === 0 && !checked && "opacity-40")}>
    <span className="inline-flex items-center gap-2.5"><input type="checkbox" checked={checked} onChange={onChange} />{label}</span>
    {count !== undefined && <span className="text-xs text-muted">{count}</span>}
  </label>
);
}
function Tri({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
  <div className="inline-flex rounded-sm border border-line-strong overflow-hidden text-sm">
    {([["Vše", null], ["Ano", true], ["Ne", false]] as [string, boolean | null][]).map(([l, v]) => (
      <button key={l} type="button" onClick={() => onChange(v)} className={clsx("px-3 py-1.5", value === v ? "bg-ink text-white" : "bg-white hover:bg-bg")}>{l}</button>
    ))}
  </div>
);
}


interface Props { filters: CatalogFilters; facets: Facets; locked: (keyof CatalogFilters)[]; total: number }

export function FilterPanel({ filters, facets, locked, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const push = (next: CatalogFilters) => {
    const cleaned = { ...next } as Partial<CatalogFilters>;
    for (const k of locked) delete cleaned[k];
    start(() => router.replace(`${pathname}${filtersToQuery(cleaned)}`, { scroll: false }));
  };
  const toggle = <K extends "type" | "lock" | "thickness" | "wear" | "usage" | "tone">(key: K, value: CatalogFilters[K][number]) => {
    const arr = filters[key] as unknown[];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    push({ ...filters, [key]: next });
  };
  const setTri = (key: "floorHeating" | "integratedUnderlay" | "waterproof", v: boolean | null) => push({ ...filters, [key]: v });
  const activeCount = [filters.type, filters.lock, filters.thickness, filters.wear, filters.usage, filters.tone].reduce((n, a) => n + a.length, 0)
    + (filters.priceMin !== null || filters.priceMax !== null ? 1 : 0) + (filters.floorHeating !== null ? 1 : 0) + (filters.integratedUnderlay !== null ? 1 : 0) + (filters.waterproof !== null ? 1 : 0) + (filters.minStock !== null ? 1 : 0);

  const body = (
    <div className={clsx(pending && "opacity-60 transition-opacity")}>
      {!locked.includes("type") && (
        <Group title="Typ podlahy">{(Object.keys(FLOOR_TYPE_LABEL) as FloorType[]).map((t) => <Opt key={t} label={FLOOR_TYPE_LABEL[t]} count={facets.type[t] ?? 0} checked={filters.type.includes(t)} onChange={() => toggle("type", t)} />)}</Group>
      )}
      {!locked.includes("tone") && (
        <Group title="Dekor / odstín">{(Object.keys(DECOR_TONE_LABEL) as DecorTone[]).map((t) => <Opt key={t} label={DECOR_TONE_LABEL[t]} count={facets.tone[t] ?? 0} checked={filters.tone.includes(t)} onChange={() => toggle("tone", t)} />)}</Group>
      )}
      <Group title="Cena za m²">
        {PRICE_BANDS.map((b) => {
          const on = filters.priceMin === b.min && filters.priceMax === b.max;
          return <Opt key={b.label} label={b.label} checked={on} onChange={() => push({ ...filters, priceMin: on ? null : b.min, priceMax: on ? null : b.max })} />;
        })}
      </Group>
      {!locked.includes("lock") && (
        <Group title="Způsob pokládky">{(Object.keys(LOCK_LABEL) as LockType[]).map((t) => <Opt key={t} label={LOCK_LABEL[t]} count={facets.lock[t] ?? 0} checked={filters.lock.includes(t)} onChange={() => toggle("lock", t)} />)}</Group>
      )}
      <Group title="Tloušťka">{Object.keys(facets.thickness).map(Number).sort((a, b) => a - b).map((t) => <Opt key={t} label={`${String(t).replace(".", ",")} mm`} count={facets.thickness[t]} checked={filters.thickness.includes(t)} onChange={() => toggle("thickness", t)} />)}</Group>
      <Group title="Nášlapná vrstva">{[0.3, 0.4, 0.55].map((w) => <Opt key={w} label={`${String(w).replace(".", ",")} mm`} count={facets.wear[w] ?? 0} checked={filters.wear.includes(w as 0.3)} onChange={() => toggle("wear", w as 0.3)} />)}</Group>
      <Group title="Třída zátěže">{[23, 31, 32, 33, 42].map((u) => <Opt key={u} label={`${u}${u >= 33 ? " (komerční)" : u === 23 ? " (bytová, nízká)" : ""}`} count={facets.usage[u] ?? 0} checked={filters.usage.includes(u as 23)} onChange={() => toggle("usage", u as 23)} />)}</Group>
      {!locked.includes("floorHeating") && <Group title="Podlahové topení"><Tri value={filters.floorHeating} onChange={(v) => setTri("floorHeating", v)} /></Group>}
      <Group title="Integrovaná podložka"><Tri value={filters.integratedUnderlay} onChange={(v) => setTri("integratedUnderlay", v)} /></Group>
      {!locked.includes("waterproof") && <Group title="Voděodolné (koupelna)"><Tri value={filters.waterproof} onChange={(v) => setTri("waterproof", v)} /></Group>}
      <Group title="Dostupnost">
        <Opt label="Aspoň 30 m² skladem" checked={filters.minStock === 30} onChange={() => push({ ...filters, minStock: filters.minStock === 30 ? null : 30 })} />
        <Opt label="Aspoň 100 m² skladem" checked={filters.minStock === 100} onChange={() => push({ ...filters, minStock: filters.minStock === 100 ? null : 100 })} />
      </Group>
      {activeCount > 0 && (
        <button type="button" className="btn btn-ghost btn-sm w-full mt-2" onClick={() => push({ ...filters, type: [], lock: [], thickness: [], wear: [], usage: [], tone: [], priceMin: null, priceMax: null, floorHeating: null, integratedUnderlay: null, waterproof: null, minStock: null })}>Zrušit filtry ({activeCount})</button>
      )}
    </div>
  );

  return (
    <div>
      <button type="button" className="btn btn-outline w-full lg:hidden" onClick={() => setOpen(true)}><Filter className="h-4 w-4" /> Filtry {activeCount > 0 && `(${activeCount})`}</button>
      <aside className="hidden lg:block sticky top-24">{body}</aside>
      <div className={clsx("fixed inset-0 z-[70] lg:hidden", open ? "visible" : "invisible")}>
        <div className={clsx("absolute inset-0 bg-ink/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <div className={clsx("absolute inset-x-0 bottom-0 max-h-[88vh] bg-bg rounded-t-lg flex flex-col transition-transform duration-300", open ? "translate-y-0" : "translate-y-full")}>
          <div className="flex items-center justify-between px-4 h-14 border-b border-line"><span className="eyebrow">Filtry</span><button className="p-2" onClick={() => setOpen(false)} aria-label="Zavřít"><X className="h-6 w-6" /></button></div>
          <div className="overflow-y-auto px-4 pb-4">{body}</div>
          <div className="p-4 border-t border-line"><button className="btn btn-primary w-full" onClick={() => setOpen(false)}>Zobrazit {total} podlah</button></div>
        </div>
      </div>
    </div>
  );
}
