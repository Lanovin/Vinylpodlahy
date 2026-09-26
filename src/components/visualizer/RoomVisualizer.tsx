"use client";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicProduct } from "@/lib/public";
import { DECOR_TONE_LABEL, LAYOUT_LABEL, type DecorTone, type LayoutMode } from "@/lib/types";
import { fmtCzk } from "@/lib/format";
import { SampleButton } from "@/components/product/SampleButton";
import { Download, Minus, Moon, Plus, Refresh, Sun } from "@/components/ui/icons";
import { FALLBACK_PALETTE, paletteFromImage, toHex, tunePalette } from "./engine/palette";
import type { Lighting, Viewer } from "./engine/viewer";
import { VIEW_OPTIONS, viewSlug, type ViewId } from "./engine/views";
import { decorKindFor, defaultLayoutFor, LAYOUT_SLUG } from "./decor";

export interface RoomVisualizerProps {
  products: PublicProduct[];
  initialProductId?: string | null;
  initialView?: ViewId | null;
  initialLayout?: LayoutMode | null;
  sampleMax: number;
  /** Řádek s cenou u dekoru (v kalkulačce cena celého projektu). */
  priceLabel?: (p: PublicProduct) => React.ReactNode;
  /** Tlačítka pro zobrazený dekor; bez nich odkaz na detail a kalkulačku. */
  renderActions?: (p: PublicProduct) => React.ReactNode;
  variant: "page" | "dialog";
  /** Stav (dekor, místnost, kladení) se propisuje do URL — sdílitelný odkaz. */
  syncUrl?: boolean;
}

const WALLS = [
  { hex: "#f1eee8", label: "Bílá" },
  { hex: "#e8e0d2", label: "Lomená bílá" },
  { hex: "#d5d5d1", label: "Světle šedá" },
  { hex: "#b9c2ad", label: "Šalvějová" },
  { hex: "#d8c3a5", label: "Písková" },
  { hex: "#5d6670", label: "Břidlicová" },
];
const LAYOUTS: LayoutMode[] = ["straight", "diagonal", "herringbone"];
const SKIRTING_WHITE = "#f4f2ee";

const darken = (hex: string, k: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");

export default function RoomVisualizer({ products, initialProductId, initialView, initialLayout, sampleMax, priceLabel, renderActions, variant, syncUrl }: RoomVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(() => (initialProductId && products.some((p) => p.id === initialProductId) ? initialProductId : products[0]?.id ?? null));
  const [view, setView] = useState<ViewId>(initialView ?? "living");
  const [layoutPick, setLayoutPick] = useState<LayoutMode | null>(initialLayout ?? null);
  const [wall, setWall] = useState(WALLS[0].hex);
  const [skirting, setSkirting] = useState<"white" | "floor">("white");
  const [lighting, setLighting] = useState<Lighting>("day");
  const [tone, setTone] = useState<DecorTone | "all">("all");
  const [engine, setEngine] = useState<"loading" | "ready" | "error">("loading");
  const [engineGen, setEngineGen] = useState(0);
  const [applied, setApplied] = useState<string | null>(null);
  const [floorHex, setFloorHex] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);

  const selected = products.find((p) => p.id === selectedId) ?? products[0] ?? null;
  const layout: LayoutMode = layoutPick ?? (selected ? defaultLayoutFor(selected) : "straight");
  const floorKey = selected ? `${selected.id}|${layout}` : null;
  const busy = engine === "ready" && floorKey !== applied;

  const tones = useMemo(() => [...new Set(products.map((p) => p.decorTone))], [products]);
  const listed = tone === "all" ? products : products.filter((p) => p.decorTone === tone);

  // Engine (three.js) se načítá až tady — zbytek webu ho nestahuje.
  useEffect(() => {
    let disposed = false;
    let v: Viewer | null = null;
    import("./engine/viewer")
      .then(({ createViewer }) => {
        if (disposed || !canvasRef.current || !overlayRef.current) return;
        try {
          v = createViewer(canvasRef.current, overlayRef.current, {
            wheelZoom: variant === "dialog",
            onReady: () => setEngine("ready"),
            onViewChange: (id) => setView(id),
          });
          viewerRef.current = v;
          setEngineGen((g) => g + 1);
        } catch {
          setEngine("error");
        }
      })
      .catch(() => setEngine("error"));
    return () => { disposed = true; v?.dispose(); viewerRef.current = null; };
  }, [variant]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !selected || !floorKey) return;
    let cancelled = false;
    const kind = decorKindFor(selected);
    const raw = selected.images.swatch ? paletteFromImage(selected.images.swatch).catch(() => FALLBACK_PALETTE[selected.decorTone]) : Promise.resolve(FALLBACK_PALETTE[selected.decorTone]);
    raw.then((pal) => {
      if (cancelled) return;
      const palette = tunePalette(pal, selected.decorTone, kind === "wood");
      // Krátká pauza, aby se stihl vykreslit indikátor — generování lamel chvíli blokuje vlákno.
      setTimeout(() => {
        if (cancelled) return;
        v.setFloor({
          seedKey: selected.id, kind, palette, bevel: selected.bevel,
          plankL: selected.plankLengthMm / 1000, plankW: selected.plankWidthMm / 1000,
          pattern: layout === "herringbone" ? "herringbone" : "straight", diagonal: layout === "diagonal",
        });
        setApplied(floorKey);
        setFloorHex(toHex(palette.base));
      }, 30);
    });
    return () => { cancelled = true; };
  }, [engineGen, selected, floorKey, layout]);

  useEffect(() => { viewerRef.current?.setView(view); }, [engineGen, view]);
  useEffect(() => { viewerRef.current?.setWallColor(wall); }, [engineGen, wall]);
  useEffect(() => { viewerRef.current?.setSkirtingColor(skirting === "floor" && floorHex ? darken(floorHex, 0.92) : SKIRTING_WHITE); }, [engineGen, skirting, floorHex]);
  useEffect(() => { viewerRef.current?.setLighting(lighting); }, [engineGen, lighting]);

  useEffect(() => {
    if (!syncUrl || !selected) return;
    const q = new URLSearchParams({ podlaha: selected.slug, mistnost: viewSlug(view) });
    if (layoutPick) q.set("klad", LAYOUT_SLUG[layoutPick]);
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  }, [syncUrl, selected, view, layoutPick]);

  const snapshot = () => {
    const url = viewerRef.current?.snapshot();
    if (!url || !selected) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `vizualizace-${selected.slug}-${viewSlug(view)}.jpg`;
    a.click();
  };

  const dialog = variant === "dialog";
  const stageH = dialog ? "h-[46svh] min-h-[280px] lg:h-full" : "h-[78vw] max-h-[560px] sm:h-[56vw] lg:h-[min(70vh,720px)] lg:max-h-none";

  return (
    <div className={clsx("grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 lg:grid-cols-[minmax(0,1fr)_360px]", dialog && "lg:h-full lg:grid-rows-1")}>
      <div className={clsx("flex flex-col gap-3 min-w-0", dialog && "lg:h-full lg:min-h-0")}>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="tablist" aria-label="Místnost">
          {VIEW_OPTIONS.map((o) => (
            <button key={o.id} type="button" role="tab" aria-selected={view === o.id} onClick={() => setView(o.id)} className={clsx("shrink-0 rounded-full px-3.5 py-1.5 text-sm border transition-colors", view === o.id ? "bg-ink text-white border-ink" : "bg-surface border-line hover:border-ink")}>{o.label}</button>
          ))}
        </div>

        <div className={clsx("relative w-full overflow-hidden rounded-lg bg-line select-none", stageH, dialog && "lg:flex-1 lg:min-h-0")} onPointerDown={() => setInteracted(true)}>
          <canvas ref={canvasRef} className={clsx("absolute inset-0 h-full w-full transition-opacity duration-500", engine === "ready" ? "opacity-100" : "opacity-0", dialog ? "touch-none" : "touch-pan-y")} aria-label="3D náhled bytu s vybranou podlahou" />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0" />

          {engine !== "ready" && (
            <div className="absolute inset-0 grid place-items-center text-center p-6">
              {engine === "error" ? (
                <p className="text-ink-soft max-w-sm">Váš prohlížeč nepodporuje 3D náhled (WebGL). Zkuste jiný prohlížeč, nebo si objednejte vzorek zdarma.</p>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted"><span className="h-8 w-8 rounded-full border-2 border-line-strong border-t-ink animate-spin" /><span className="text-sm">Připravuji modelový byt…</span></div>
              )}
            </div>
          )}

          {engine === "ready" && (
            <>
              <div className="absolute right-2 top-2 flex flex-col gap-1.5">
                <div className="flex rounded-full bg-white/90 shadow-card p-0.5">
                  <button type="button" onClick={() => setLighting("day")} aria-pressed={lighting === "day"} className={clsx("h-8 w-8 grid place-items-center rounded-full", lighting === "day" && "bg-ink text-white")} title="Denní světlo"><Sun className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setLighting("evening")} aria-pressed={lighting === "evening"} className={clsx("h-8 w-8 grid place-items-center rounded-full", lighting === "evening" && "bg-ink text-white")} title="Večer s lampami"><Moon className="h-4 w-4" /></button>
                </div>
                <div className="hidden sm:flex flex-col rounded-full bg-white/90 shadow-card p-0.5 self-end">
                  <button type="button" onClick={() => viewerRef.current?.zoom(1.2)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg" title="Přiblížit"><Plus className="h-4 w-4" /></button>
                  <button type="button" onClick={() => viewerRef.current?.zoom(1 / 1.2)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg" title="Oddálit"><Minus className="h-4 w-4" /></button>
                  <button type="button" onClick={() => viewerRef.current?.resetView()} className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg" title="Výchozí pohled"><Refresh className="h-4 w-4" /></button>
                </div>
                <button type="button" onClick={snapshot} className="h-9 w-9 self-end grid place-items-center rounded-full bg-white/90 shadow-card hover:bg-white" title="Uložit obrázek"><Download className="h-4 w-4" /></button>
              </div>

              {busy && <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs shadow-card inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-line-strong border-t-ink animate-spin" />Pokládám podlahu…</div>}
              {!interacted && view !== "overview" && <div className="absolute left-1/2 bottom-3 -translate-x-1/2 rounded-full bg-ink/70 text-white px-3 py-1 text-xs pointer-events-none whitespace-nowrap">Táhnutím se rozhlédnete · dvojklik vrátí pohled</div>}
              {view === "overview" && <div className="absolute left-1/2 bottom-3 -translate-x-1/2 rounded-full bg-ink/70 text-white px-3 py-1 text-xs pointer-events-none whitespace-nowrap">Klikněte na místnost</div>}

              {selected && (
                <div className="absolute left-2 top-2 max-w-[62%] rounded-md bg-white/90 px-3 py-2 shadow-card pointer-events-none">
                  <p className="text-[0.65rem] tracking-[0.14em] uppercase text-muted truncate">{selected.brand} · {selected.collection}</p>
                  <p className="text-sm sm:text-base leading-tight truncate">{selected.decor}</p>
                  <p className="text-[0.7rem] text-ink-soft mt-0.5">lamela {selected.plankLengthMm} × {selected.plankWidthMm} mm · {selected.bevel ? "V-drážka" : "bez fáze"} · {LAYOUT_LABEL[layout].toLowerCase()}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <aside className={clsx("panel !p-4 flex flex-col gap-4 min-w-0", dialog ? "lg:h-full lg:min-h-0" : "lg:h-[calc(min(70vh,720px)+2.75rem)]")}>
        <div className="flex flex-col gap-2 min-h-0 lg:flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="label !mb-0">Dekor podlahy</p>
            <span className="text-xs text-muted">{listed.length} z {products.length}</span>
          </div>
          {tones.length > 1 && products.length > 5 && (
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...tones] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTone(t)} className={clsx("tag shrink-0 !normal-case !tracking-normal !text-xs", tone === t ? "!bg-ink !text-white !border-ink" : "hover:border-ink")}>{t === "all" ? "Vše" : DECOR_TONE_LABEL[t]}</button>
              ))}
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:min-h-0 lg:flex-1 lg:pb-0">
            {listed.map((p) => {
              const on = p.id === selected?.id;
              return (
                <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} aria-pressed={on} className={clsx("shrink-0 w-[200px] lg:w-auto flex items-center gap-3 text-left rounded-md border-2 p-1.5 transition-colors", on ? "border-ink bg-bg" : "border-transparent hover:bg-bg")}>
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-line">{p.images.swatch && <Image src={p.images.swatch} alt="" fill sizes="48px" className="object-cover" />}</span>
                  <span className="min-w-0">
                    <span className="block text-sm leading-tight truncate">{p.decor}</span>
                    <span className="block text-xs text-muted truncate">{p.brand} · {p.collection}</span>
                    <span className="block text-xs text-ink-soft mt-0.5 tabular-nums">{priceLabel ? priceLabel(p) : `${fmtCzk(p.pricePerM2)}/m²`}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="label">Způsob kladení</p>
          <div className="grid grid-cols-3 gap-1.5">
            {LAYOUTS.map((m) => (
              <button key={m} type="button" onClick={() => setLayoutPick(m)} aria-pressed={layout === m} className={clsx("rounded-sm border px-2 py-1.5 text-sm", layout === m ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink")}>{LAYOUT_LABEL[m]}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 items-center">
          <p className="label !mb-0">Stěny</p>
          <div className="flex gap-1.5">
            {WALLS.map((w) => (
              <button key={w.hex} type="button" onClick={() => setWall(w.hex)} title={w.label} aria-label={`Stěny: ${w.label}`} aria-pressed={wall === w.hex} className={clsx("h-6 w-6 rounded-full border", wall === w.hex ? "ring-2 ring-ink ring-offset-2 border-transparent" : "border-line-strong")} style={{ background: w.hex }} />
            ))}
          </div>
          <p className="label !mb-0">Soklové lišty</p>
          <div className="flex rounded-sm border border-line-strong overflow-hidden text-xs">
            {(["white", "floor"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSkirting(s)} aria-pressed={skirting === s} className={clsx("px-2.5 py-1.5", skirting === s ? "bg-ink text-white" : "bg-white hover:bg-bg")}>{s === "white" ? "Bílé" : "Jako podlaha"}</button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="border-t border-line pt-4 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {renderActions ? renderActions(selected) : (
                <>
                  <Link href={`/podlaha/${selected.slug}`} className="btn btn-primary btn-sm">Detail podlahy</Link>
                  <Link href={`/kalkulacka?product=${selected.slug}`} className="btn btn-outline btn-sm">Spočítat projekt</Link>
                </>
              )}
            </div>
            <SampleButton productId={selected.id} max={sampleMax} size="sm" />
            <p className="text-xs text-muted leading-snug">Podlaha je složená z lamel ve skutečném rozměru; barva a kresba vychází z fotografie dekoru. Monitor a světlo u vás doma ji mění — před objednávkou si nechte poslat vzorek.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
