"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { CatalogFilters } from "@/lib/catalog";
import { PRICE_BANDS } from "@/lib/catalog";
import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LOCK_LABEL } from "@/lib/types";
import type { DecorTone, FloorType, LockType } from "@/lib/types";
import { plural } from "@/lib/format";
import { useHydrated } from "@/store/cart";
import { ChevronDown, Filter, X } from "@/components/ui/icons";
import { SortSelect } from "./SortSelect";
import { activeChips, catalogHref, clearedFilters } from "./activeFilters";

export interface Facets {
  type: Record<string, number>;
  lock: Record<string, number>;
  thickness: Record<string, number>;
  wear: Record<string, number>;
  usage: Record<string, number>;
  tone: Record<string, number>;
  waterproof: number;
  floorHeating: number;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
  <fieldset className="pb-2 border-b border-line last:border-0"><legend className="eyebrow pt-4 pb-1">{title}</legend>{children}</fieldset>
);
}
function Opt({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count?: number }) {
  return (
  <label className={clsx("check min-h-11 py-2 text-[0.95rem] w-full justify-between", count === 0 && !checked && "opacity-40")}>
    <span className="inline-flex items-center gap-2.5"><input type="checkbox" checked={checked} onChange={onChange} />{label}</span>
    {count !== undefined && <span className="text-xs text-muted">{count}</span>}
  </label>
);
}
/** Štítek-přepínač pro číselné parametry (tloušťka, nášlap). */
function Chip({ checked, onChange, label, count }: { checked: boolean; onChange: () => void; label: string; count: number }) {
  return (
  <button type="button" aria-pressed={checked} onClick={onChange} className={clsx("h-11 rounded-sm border px-2 text-sm", checked ? "bg-ink text-white border-ink" : "bg-surface border-line-strong hover:border-ink", count === 0 && !checked && "opacity-40")}>{label}</button>
);
}
function Tri({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
  <div className="inline-flex rounded-sm border border-line-strong overflow-hidden text-sm mt-1">
    {([["Vše", null], ["Ano", true], ["Ne", false]] as [string, boolean | null][]).map(([l, v]) => (
      <button key={l} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={clsx("h-11 px-4", value === v ? "bg-ink text-white" : "bg-white hover:bg-bg")}>{l}</button>
    ))}
  </div>
);
}

const mm = (n: number) => `${String(n).replace(".", ",")} mm`;

interface Props { filters: CatalogFilters; facets: Facets; locked: (keyof CatalogFilters)[]; total: number }

/**
 * Filtry katalogu. Na telefonu sticky lišta [Filtry (n)] [řazení] a panel zespodu (přes portal —
 * uvnitř sticky lišty by `fixed` zůstal v jejím vrstvení pod hlavičkou a spodní lištou);
 * na desktopu boční panel.
 */
export function FilterPanel({ filters, facets, locked, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const techActive = filters.thickness.length + filters.wear.length + filters.usage.length > 0 || filters.integratedUnderlay !== null || filters.minStock !== null;
  const [techOpen, setTechOpen] = useState(techActive);

  // Otevřený panel: stránka pod ním se neposouvá, Esc zavře.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open]);

  const go = (href: string) => start(() => router.replace(href, { scroll: false }));
  const push = (next: CatalogFilters) => go(catalogHref(pathname, next, locked));
  const clearAll = () => go(catalogHref(pathname, clearedFilters(filters), locked));
  const toggle = <K extends "type" | "lock" | "thickness" | "wear" | "usage" | "tone">(key: K, value: CatalogFilters[K][number]) => {
    const arr = filters[key] as unknown[];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    push({ ...filters, [key]: next });
  };
  const setTri = (key: "floorHeating" | "integratedUnderlay" | "waterproof", v: boolean | null) => push({ ...filters, [key]: v });
  // Zamčené filtry landing page (a hledání) se do počtu nepočítají.
  const activeCount = activeChips(filters, [...locked, "q"]).length;
  const showRoom = !locked.includes("waterproof") || !locked.includes("floorHeating");

  const body = (
    <div className={clsx(pending && "opacity-60 transition-opacity")}>
      {!locked.includes("type") && (
        <Group title="Typ podlahy">{(Object.keys(FLOOR_TYPE_LABEL) as FloorType[]).map((t) => <Opt key={t} label={FLOOR_TYPE_LABEL[t]} count={facets.type[t] ?? 0} checked={filters.type.includes(t)} onChange={() => toggle("type", t)} />)}</Group>
      )}
      {!locked.includes("tone") && (
        <Group title="Odstín">{(Object.keys(DECOR_TONE_LABEL) as DecorTone[]).map((t) => <Opt key={t} label={DECOR_TONE_LABEL[t]} count={facets.tone[t] ?? 0} checked={filters.tone.includes(t)} onChange={() => toggle("tone", t)} />)}</Group>
      )}
      <Group title="Cena za m²">
        {PRICE_BANDS.map((b) => {
          const on = filters.priceMin === b.min && filters.priceMax === b.max;
          return <Opt key={b.label} label={b.label} checked={on} onChange={() => push({ ...filters, priceMin: on ? null : b.min, priceMax: on ? null : b.max })} />;
        })}
      </Group>
      {showRoom && (
        <Group title="Místnost">
          {!locked.includes("waterproof") && <Opt label="Do koupelny (voděodolné)" count={facets.waterproof} checked={filters.waterproof === true} onChange={() => setTri("waterproof", filters.waterproof === true ? null : true)} />}
          {!locked.includes("floorHeating") && <Opt label="Na podlahové topení" count={facets.floorHeating} checked={filters.floorHeating === true} onChange={() => setTri("floorHeating", filters.floorHeating === true ? null : true)} />}
        </Group>
      )}
      {!locked.includes("lock") && (
        <Group title="Pokládka">{(Object.keys(LOCK_LABEL) as LockType[]).map((t) => <Opt key={t} label={LOCK_LABEL[t]} count={facets.lock[t] ?? 0} checked={filters.lock.includes(t)} onChange={() => toggle("lock", t)} />)}</Group>
      )}
      <details open={techOpen} onToggle={(e) => setTechOpen(e.currentTarget.open)} className="group/tech">
        <summary className="eyebrow flex min-h-12 cursor-pointer list-none items-center justify-between py-3 [&::-webkit-details-marker]:hidden">
          Technické parametry <ChevronDown className="h-4 w-4 transition-transform group-open/tech:rotate-180" />
        </summary>
        <Group title="Tloušťka">
          <div className="grid grid-cols-3 gap-2 pt-1">{Object.keys(facets.thickness).map(Number).sort((a, b) => a - b).map((t) => <Chip key={t} label={mm(t)} count={facets.thickness[t]} checked={filters.thickness.includes(t)} onChange={() => toggle("thickness", t)} />)}</div>
        </Group>
        <Group title="Nášlapná vrstva">
          <div className="grid grid-cols-3 gap-2 pt-1">{[0.3, 0.4, 0.55].map((w) => <Chip key={w} label={mm(w)} count={facets.wear[w] ?? 0} checked={filters.wear.includes(w as 0.3)} onChange={() => toggle("wear", w as 0.3)} />)}</div>
        </Group>
        <Group title="Třída zátěže">{[23, 31, 32, 33, 42].map((u) => <Opt key={u} label={`${u}${u >= 33 ? " (komerční)" : u === 23 ? " (bytová, nízká)" : ""}`} count={facets.usage[u] ?? 0} checked={filters.usage.includes(u as 23)} onChange={() => toggle("usage", u as 23)} />)}</Group>
        <Group title="Integrovaná podložka"><Tri value={filters.integratedUnderlay} onChange={(v) => setTri("integratedUnderlay", v)} /></Group>
        <Group title="Dostupnost">
          <Opt label="Aspoň 30 m² skladem" checked={filters.minStock === 30} onChange={() => push({ ...filters, minStock: filters.minStock === 30 ? null : 30 })} />
          <Opt label="Aspoň 100 m² skladem" checked={filters.minStock === 100} onChange={() => push({ ...filters, minStock: filters.minStock === 100 ? null : 100 })} />
        </Group>
      </details>
    </div>
  );

  const sheet = (
    <div className={clsx("fixed inset-0 z-[70] lg:hidden transition-[visibility] duration-300", open ? "visible" : "invisible")} role="dialog" aria-modal="true" aria-label="Filtry">
      <div className={clsx("absolute inset-0 bg-ink/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
      <div className={clsx("absolute inset-x-0 bottom-0 max-h-[88dvh] bg-bg rounded-t-lg flex flex-col transition-transform duration-300", open ? "translate-y-0" : "translate-y-full")}>
        <div className="flex shrink-0 items-center justify-between gap-2 h-14 pl-4 pr-1 border-b border-line">
          <span className="eyebrow">Filtry</span>
          <div className="flex items-center gap-1">
            {activeCount > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>Zrušit vše</button>}
            <button type="button" className="grid h-11 w-11 place-items-center" onClick={() => setOpen(false)} aria-label="Zavřít"><X className="h-6 w-6" /></button>
          </div>
        </div>
        <div className="overflow-y-auto overscroll-contain px-4 pb-4">{body}</div>
        <div className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line"><button type="button" className="btn btn-primary w-full" onClick={() => setOpen(false)}>Zobrazit {total} {plural(total, "podlahu", "podlahy", "podlah")}</button></div>
      </div>
    </div>
  );

  return (
    <>
      {/* Bez backdrop-blur a průhlednosti: plné pozadí, obsah pod lištou neprosvítá. */}
      <div className="lg:hidden sticky top-16 md:top-20 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-bg border-b border-line grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-outline h-11 w-full" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}><Filter className="h-4 w-4" /> Filtry{activeCount > 0 && ` (${activeCount})`}</button>
        <SortSelect value={filters.sort} className="h-11 border-ink" />
      </div>
      <aside className="hidden lg:block lg:self-start sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto overscroll-contain pr-2" aria-label="Filtry">
        <div className="flex items-center justify-between min-h-11">
          <span className="eyebrow">Filtry</span>
          {activeCount > 0 && <button type="button" className="text-sm link" onClick={clearAll}>Zrušit vše ({activeCount})</button>}
        </div>
        {body}
      </aside>
      {hydrated && createPortal(sheet, document.body)}
    </>
  );
}
