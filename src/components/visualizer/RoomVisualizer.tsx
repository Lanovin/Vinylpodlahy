"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicProduct } from "@/lib/public";
import { DECOR_TONE_LABEL, LAYOUT_LABEL, type DecorTone, type LayoutMode } from "@/lib/types";
import { fmtCzk } from "@/lib/format";
import { SampleButton } from "@/components/product/SampleButton";
import { ArrowRight, ChevronDown, Download, Minus, Moon, Plus, Refresh, Share, Sun, X } from "@/components/ui/icons";
import { FALLBACK_PALETTE, paletteFromImage, toHex, tunePalette } from "./engine/palette";
import { LEVEL_LABEL, lowerLevel, type Detection, type QualityChoice, type QualityLevel } from "./engine/quality";
import type { Lighting, Viewer } from "./engine/viewer";
import { VIEW_OPTIONS, viewSlug, type ViewId } from "./engine/views";
import { calcHref, decorKindFor, defaultLayoutFor, LAYOUT_SLUG } from "./decor";

export interface RoomVisualizerProps {
  products: PublicProduct[];
  initialProductId?: string | null;
  initialView?: ViewId | null;
  initialLayout?: LayoutMode | null;
  sampleMax: number;
  /** Krátká cena u dekoru (v kalkulačce cena celého projektu). */
  priceLabel?: (p: PublicProduct) => React.ReactNode;
  /** Hlavní akce pro zobrazený dekor (na telefonu ve spodní liště); bez nich plocha → kalkulačka a detail podlahy. */
  renderActions?: (p: PublicProduct, ctx: { layout: LayoutMode; /** Úzká lišta na telefonu (jinak panel vedle bytu). */ compact: boolean }) => React.ReactNode;
  /** Uživatel změnil kladení — kalkulačka podle něj přepočítá ceny. */
  onLayoutChange?: (layout: LayoutMode) => void;
  /** page = samostatná stránka (plátno drží nahoře, lišta dole), inline = vložené do jiné stránky, dialog = přes celou obrazovku. */
  variant: "page" | "inline" | "dialog";
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

const QUALITY_KEY = "vp-viz-quality";
const CHOICES: { id: QualityChoice; label: string }[] = [{ id: "auto", label: "Auto" }, { id: "high", label: LEVEL_LABEL.high }, { id: "medium", label: LEVEL_LABEL.medium }, { id: "low", label: LEVEL_LABEL.low }];
const loadChoice = (): QualityChoice => {
  try { const v = localStorage.getItem(QUALITY_KEY); if (v === "high" || v === "medium" || v === "low") return v; } catch { /* ignore */ }
  return "auto";
};
const saveChoice = (c: QualityChoice) => { try { if (c === "auto") localStorage.removeItem(QUALITY_KEY); else localStorage.setItem(QUALITY_KEY, c); } catch { /* ignore */ } };

const darken = (hex: string, k: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");

export default function RoomVisualizer({ products, initialProductId, initialView, initialLayout, sampleMax, priceLabel, renderActions, onLayoutChange, variant, syncUrl }: RoomVisualizerProps) {
  const router = useRouter();
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
  const [qualityPick, setQualityPick] = useState<QualityChoice>(loadChoice);
  const [detected, setDetected] = useState<Detection | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Nové plátno pro nový 3D kontext (po zrušeném kontextu nejde na stejném plátně vytvořit další).
  const [canvasKey, setCanvasKey] = useState(0);
  const qualityRef = useRef<QualityLevel>("high");
  const [applied, setApplied] = useState<string | null>(null);
  const [floorHex, setFloorHex] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [lightBusy, setLightBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [areaInput, setAreaInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === selectedId) ?? products[0] ?? null;
  const layout: LayoutMode = layoutPick ?? (selected ? defaultLayoutFor(selected) : "straight");
  const floorKey = selected ? `${selected.id}|${layout}` : null;
  const busy = engine === "ready" && floorKey !== applied;

  const tones = useMemo(() => [...new Set(products.map((p) => p.decorTone))], [products]);
  const listed = tone === "all" ? products : products.filter((p) => p.decorTone === tone);

  /** Ruční nebo automatická změna náročnosti: 3D se spustí znovu na novém plátně. */
  const changeQuality = useCallback((choice: QualityChoice) => {
    setEngine("loading");
    setQualityPick(choice);
  }, []);

  /** Přepne na nižší stupeň (pomalé tažení, ztráta grafického kontextu) a řekne to uživateli. */
  const stepDown = useCallback((why: string) => {
    const next = lowerLevel(qualityRef.current);
    if (!next) { setEngine("error"); return; }
    setNotice(`${why} Přepnuto na „${LEVEL_LABEL[next]}“.`);
    saveChoice(next);
    changeQuality(next);
  }, [changeQuality]);

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
            quality: qualityPick,
            onQuality: (d) => { qualityRef.current = d.level; setDetected(d); },
            onReady: () => setEngine("ready"),
            onViewChange: (id) => setView(id),
            onBusy: setLightBusy,
            onSlow: () => stepDown("Zobrazení se při tažení zasekává."),
            onLost: () => stepDown("Prohlížeč přerušil 3D (málo paměti grafiky)."),
          });
          viewerRef.current = v;
          setEngineGen((g) => g + 1);
        } catch {
          setEngine("error");
        }
      })
      .catch(() => setEngine("error"));
    return () => { disposed = true; v?.dispose(); viewerRef.current = null; };
  }, [variant, qualityPick, canvasKey, stepDown]);

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

  // Oznámení o změně režimu zmizí samo.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 9000);
    return () => clearTimeout(t);
  }, [notice]);

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
  /** Sdílení odkazu (adresa nese dekor, místnost i kladení) — na telefonu nativní nabídka, jinak schránka. */
  const share = async () => {
    if (!selected) return;
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: `${selected.brand} ${selected.decor} ve 3D`, url }); } catch { /* zrušeno */ } return; }
    try { await navigator.clipboard.writeText(url); setNotice("Odkaz zkopírován."); } catch { /* ignore */ }
  };
  const pickLayout = (m: LayoutMode) => { setLayoutPick(m); onLayoutChange?.(m); };

  // Vybraný dekor a místnost držíme v posuvných řadách na očích (i po odkazu ?podlaha= nebo změně odstínu).
  useEffect(() => { centerPressed(listRef.current); }, [selectedId, tone]);
  useEffect(() => { centerPressed(tabsRef.current, '[aria-selected="true"]'); }, [view]);

  const dialog = variant === "dialog";
  const page = variant === "page";
  const areaNum = parseFloat(areaInput.replace(",", "."));
  const area = Number.isFinite(areaNum) && areaNum > 0 ? areaNum : null;
  const priceOf = (p: PublicProduct) => (priceLabel ? priceLabel(p) : `${fmtCzk(p.pricePerM2)}/m²`);
  const stageH = dialog
    ? "h-[56svh] min-h-[260px] lg:h-full max-lg:landscape:h-[calc(100svh-7rem)] max-lg:landscape:min-h-0"
    : page
      ? "h-[46svh] min-h-[260px] max-h-[560px] sm:h-[56vw] lg:h-[min(70vh,720px)] lg:max-h-none max-lg:landscape:h-[calc(100svh-8.5rem)] max-lg:landscape:min-h-0"
      : "h-[64vw] max-h-[480px] sm:h-[50vw] lg:h-[min(60vh,600px)]";

  /** Výchozí akce: plocha → kalkulačka s touto podlahou a kladením (s plochou rovnou cena). */
  const calcForm = (p: PublicProduct, compact: boolean) => (
    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); router.push(calcHref(p, layout, area)); }}>
      <label className={clsx("relative shrink-0", compact ? "w-[4.5rem]" : "w-28")}>
        <span className="sr-only">Plocha v m² (nepovinné)</span>
        {/* Na úzké liště je jednotka v placeholderu (číslo by vypadalo jako vyplněná hodnota); po vyplnění se ukáže vpravo. */}
        <input inputMode="decimal" enterKeyHint="go" placeholder={compact ? "m²" : "Plocha"} value={areaInput} onChange={(e) => setAreaInput(e.target.value)} className={clsx("input !py-2 !pl-2.5 h-11", compact && !areaInput ? "!pr-2.5" : "!pr-8")} />
        {(!compact || areaInput) && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted">m²</span>}
      </label>
      <button type="submit" className={clsx("btn btn-accent shrink-0", compact ? "!px-3.5" : "flex-1")}>Spočítat cenu <ArrowRight className="h-4 w-4" /></button>
    </form>
  );
  const actions = (p: PublicProduct, compact: boolean) => renderActions ? renderActions(p, { layout, compact }) : calcForm(p, compact);

  /** Lišta vybraného dekoru s hlavní akcí — na telefonu vždy po ruce. */
  const bar = selected && (
    <div className={clsx(
      "lg:hidden z-30 bg-bg/95 backdrop-blur border-line",
      page && "fixed inset-x-0 bottom-[var(--cookie-h,0px)] border-t pb-[env(safe-area-inset-bottom)] max-lg:landscape:hidden",
      dialog && "sticky bottom-0 -mx-3 md:-mx-5 px-3 md:px-5 border-t",
      variant === "inline" && "rounded-md border px-3",
    )}>
      <div className={clsx("flex items-center gap-2 py-2", page && "container")}>
        <div className="flex-1 min-w-0 leading-tight">
          <p className="text-sm truncate">{selected.decor}</p>
          <p className="text-xs text-muted tabular-nums truncate">{priceOf(selected)}</p>
        </div>
        <div className="shrink-0">{actions(selected, true)}</div>
      </div>
    </div>
  );

  return (
    <div className={clsx("grid grid-cols-[minmax(0,1fr)] gap-4 lg:gap-5 lg:grid-cols-[minmax(0,1fr)_360px] max-lg:landscape:grid-cols-[minmax(0,1fr)_280px]", dialog && "lg:h-full lg:grid-rows-1")}>
      <div className={clsx("flex flex-col gap-2 sm:gap-3 min-w-0", dialog && "lg:h-full lg:min-h-0", page && "max-md:sticky max-md:top-16 max-md:z-20 max-md:bg-bg max-md:pb-2 max-sm:-mx-4")}>
        <div ref={tabsRef} className={clsx("relative flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pr-8 max-sm:[mask-image:linear-gradient(to_right,black_85%,transparent)]", page && "max-sm:mx-0 max-sm:px-4")} role="tablist" aria-label="Místnost">
          {VIEW_OPTIONS.map((o) => (
            <button key={o.id} type="button" role="tab" aria-selected={view === o.id} onClick={() => setView(o.id)} className={clsx("shrink-0 rounded-full px-4 h-10 text-sm border transition-colors", view === o.id ? "bg-ink text-white border-ink" : "bg-surface border-line hover:border-ink")}>{o.label}</button>
          ))}
        </div>

        <div className={clsx("relative w-full overflow-hidden rounded-lg bg-line select-none", stageH, dialog && "lg:flex-1 lg:min-h-0", page && "max-sm:rounded-none")} onPointerDown={() => setInteracted(true)}>
          <canvas key={`${qualityPick}-${canvasKey}`} ref={canvasRef} className={clsx("absolute inset-0 h-full w-full transition-opacity duration-500", engine === "ready" ? "opacity-100" : "opacity-0", dialog ? "touch-none" : "touch-pan-y")} aria-label="3D náhled bytu s vybranou podlahou" />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0" />

          {engine !== "ready" && (
            <div className="absolute inset-0 grid place-items-center text-center p-6">
              {engine === "error" ? (
                <>
                  {selected?.images.card && <Image src={selected.images.card} alt="" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover opacity-40" />}
                  <div className="relative max-w-sm rounded-md bg-white/95 p-5 shadow-card">
                    <p>3D se na tomto zařízení nespustilo.</p>
                    <p className="text-sm text-muted mt-2 leading-snug">Zkuste úsporný režim, nebo si dekor prohlédněte na fotce.</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => { setCanvasKey((k) => k + 1); changeQuality("low"); }}>Zkusit úsporný režim</button>
                      {selected && <Link href={`/podlaha/${selected.slug}`} className="btn btn-outline btn-sm">Detail podlahy</Link>}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted">
                  <span className="h-8 w-8 rounded-full border-2 border-line-strong border-t-ink animate-spin" />
                  <span className="text-sm">Připravuji modelový byt…</span>
                  {detected?.level === "low" && <span className="text-xs">Úsporný režim ({detected.reason})</span>}
                </div>
              )}
            </div>
          )}

          {engine === "ready" && (
            <>
              <div className="absolute right-2 top-2 flex flex-col items-end gap-1.5">
                <div className="flex rounded-full bg-white/90 shadow-card p-0.5">
                  <button type="button" onClick={() => setLighting("day")} aria-pressed={lighting === "day"} className={clsx("h-10 w-10 grid place-items-center rounded-full", lighting === "day" && "bg-ink text-white")} title="Denní světlo" aria-label="Denní světlo"><Sun className="h-5 w-5" /></button>
                  <button type="button" onClick={() => setLighting("evening")} aria-pressed={lighting === "evening"} className={clsx("h-10 w-10 grid place-items-center rounded-full", lighting === "evening" && "bg-ink text-white")} title="Večer s lampami" aria-label="Večer s lampami"><Moon className="h-5 w-5" /></button>
                </div>
                <div className="hidden pointer-fine:flex flex-col rounded-full bg-white/90 shadow-card p-0.5">
                  <button type="button" onClick={() => viewerRef.current?.zoom(1.2)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg" title="Přiblížit" aria-label="Přiblížit"><Plus className="h-4 w-4" /></button>
                  <button type="button" onClick={() => viewerRef.current?.zoom(1 / 1.2)} className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg" title="Oddálit" aria-label="Oddálit"><Minus className="h-4 w-4" /></button>
                  <button type="button" onClick={() => viewerRef.current?.resetView()} className="h-8 w-8 grid place-items-center rounded-full hover:bg-bg" title="Výchozí pohled" aria-label="Výchozí pohled"><Refresh className="h-4 w-4" /></button>
                </div>
                {/* Dotyk: přiblížení prsty, ale návrat do výchozího pohledu potřebuje tlačítko (44 px) */}
                <button type="button" onClick={() => viewerRef.current?.resetView()} className="pointer-fine:hidden h-11 w-11 grid place-items-center rounded-full bg-white/90 shadow-card" title="Výchozí pohled" aria-label="Výchozí pohled"><Refresh className="h-5 w-5" /></button>
                {syncUrl && <button type="button" onClick={share} className="h-10 w-10 grid place-items-center rounded-full bg-white/90 shadow-card hover:bg-white" title="Sdílet odkaz" aria-label="Sdílet odkaz"><Share className="h-4 w-4" /></button>}
                <button type="button" onClick={snapshot} className="h-10 w-10 grid place-items-center rounded-full bg-white/90 shadow-card hover:bg-white" title="Uložit obrázek" aria-label="Uložit obrázek"><Download className="h-4 w-4" /></button>
              </div>

              {(busy || lightBusy) && <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs shadow-card inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full border-2 border-line-strong border-t-ink animate-spin" />{busy ? "Pokládám podlahu…" : "Rozsvěcuji lampy…"}</div>}
              {notice && (
                <div className="absolute inset-x-2 bottom-2 flex items-start gap-2 rounded-md bg-ink/85 px-3 py-2 text-xs text-white shadow-card" role="status">
                  <span className="flex-1 leading-snug">{notice}</span>
                  <button type="button" className="shrink-0 -mr-1 p-0.5 hover:opacity-70" onClick={() => setNotice(null)} aria-label="Zavřít oznámení"><X className="h-4 w-4" /></button>
                </div>
              )}
              {!notice && !interacted && view !== "overview" && (
                <div className="absolute left-1/2 bottom-3 -translate-x-1/2 rounded-full bg-ink/70 text-white px-3 py-1 text-xs pointer-events-none whitespace-nowrap">
                  <span className="pointer-coarse:hidden">Tažením se rozhlédnete · dvojklik = zpět</span><span className="hidden pointer-coarse:inline">Táhněte prstem a rozhlédněte se</span>
                </div>
              )}
              {view === "overview" && <div className="absolute left-1/2 bottom-3 -translate-x-1/2 rounded-full bg-ink/70 text-white px-3 py-1 text-xs pointer-events-none whitespace-nowrap"><span className="pointer-coarse:hidden">Klikněte</span><span className="hidden pointer-coarse:inline">Klepněte</span> na místnost</div>}

              {/* Štítek dekoru — na telefonu ho nahrazuje lišta s cenou */}
              {selected && (
                <div className="hidden sm:block absolute left-2 top-2 max-w-[55%] rounded-md bg-white/90 px-3 py-2 shadow-card pointer-events-none">
                  <p className="text-xs tracking-[0.12em] uppercase text-muted truncate">{selected.brand} · {selected.collection}</p>
                  <p className="leading-tight truncate">{selected.decor}</p>
                  <p className="text-xs text-ink-soft mt-0.5 truncate">{selected.decorTone === "stone" ? "dlaždice" : "lamela"} {selected.plankLengthMm} × {selected.plankWidthMm} mm · {selected.bevel ? "V-drážka" : "bez fáze"} · {LAYOUT_LABEL[layout].toLowerCase()}</p>
                </div>
              )}
            </>
          )}
        </div>
        {variant === "inline" && bar}
      </div>

      <aside className={clsx("panel !p-3 sm:!p-4 flex flex-col gap-4 min-w-0", dialog ? "lg:h-full lg:min-h-0" : page ? "lg:h-[calc(min(70vh,720px)+3.25rem)]" : "lg:h-[calc(min(60vh,600px)+3.25rem)]", "max-lg:landscape:max-h-[calc(100svh-5rem)] max-lg:landscape:overflow-y-auto")}>
        <div className="flex flex-col gap-2 min-h-0 lg:flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="label !mb-0">Dekor podlahy</p>
            <span className="text-xs text-muted">{listed.length} z {products.length}</span>
          </div>
          {tones.length > 1 && products.length > 5 && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 lg:flex-wrap">
              {(["all", ...tones] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTone(t)} aria-pressed={tone === t} className={clsx("tag shrink-0 min-h-9 !px-3 !normal-case !tracking-normal !text-sm lg:!text-xs lg:min-h-0", tone === t ? "!bg-ink !text-white !border-ink" : "hover:border-ink")}>{t === "all" ? "Vše" : DECOR_TONE_LABEL[t]}</button>
              ))}
            </div>
          )}
          <div ref={listRef} className="relative flex gap-1.5 lg:gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:min-h-0 lg:flex-1 lg:pb-0">
            {listed.map((p) => {
              const on = p.id === selected?.id;
              return (
                <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} aria-pressed={on} className={clsx("shrink-0 w-[5.25rem] lg:w-auto flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 text-left rounded-md border-2 p-1 lg:p-1.5 transition-colors", on ? "border-ink bg-bg" : "border-transparent hover:bg-bg")}>
                  <span className="relative block aspect-square w-full lg:h-12 lg:w-12 shrink-0 overflow-hidden rounded-sm bg-line">{p.images.swatch && <Image src={p.images.swatch} alt="" fill sizes="84px" className="object-cover" />}</span>
                  <span className="block min-w-0 w-full">
                    <span className="block text-xs lg:text-sm leading-tight truncate">{p.decor}</span>
                    <span className="hidden lg:block text-xs text-muted truncate">{p.brand} · {p.collection}</span>
                    <span className="block text-xs text-ink-soft mt-0.5 tabular-nums truncate">{priceOf(p)}</span>
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
              <button key={m} type="button" onClick={() => pickLayout(m)} aria-pressed={layout === m} className={clsx("rounded-sm border px-2 h-10 lg:h-9 text-sm", layout === m ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink")}>{LAYOUT_LABEL[m]}</button>
            ))}
          </div>
        </div>

        {/* Méně častá nastavení — na telefonu sbalená */}
        <button type="button" className="lg:hidden flex items-center justify-between h-10 text-sm -my-1" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
          Upravit interiér <span className="text-muted inline-flex items-center gap-1 text-xs">stěny, lišty, kvalita <ChevronDown className={clsx("h-4 w-4 transition-transform", moreOpen && "rotate-180")} /></span>
        </button>
        <div className={clsx("flex-col gap-4", moreOpen ? "flex" : "hidden lg:flex")}>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 items-center">
            <p className="label !mb-0">Stěny</p>
            <div className="flex flex-wrap justify-end gap-1.5">
              {WALLS.map((w) => (
                <button key={w.hex} type="button" onClick={() => setWall(w.hex)} title={w.label} aria-label={`Stěny: ${w.label}`} aria-pressed={wall === w.hex} className={clsx("h-9 w-9 lg:h-7 lg:w-7 rounded-full border", wall === w.hex ? "ring-2 ring-ink ring-offset-2 border-transparent" : "border-line-strong")} style={{ background: w.hex }} />
              ))}
            </div>
            <p className="label !mb-0">Soklové lišty</p>
            <div className="flex justify-end">
              <div className="flex rounded-sm border border-line-strong overflow-hidden text-sm lg:text-xs">
                {(["white", "floor"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => setSkirting(s)} aria-pressed={skirting === s} className={clsx("px-3 h-10 lg:h-8", skirting === s ? "bg-ink text-white" : "bg-white hover:bg-bg")}>{s === "white" ? "Bílé" : "Jako podlaha"}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="label">Kvalita obrazu</p>
            <div className="grid grid-cols-4 gap-1" role="group" aria-label="Kvalita obrazu">
              {CHOICES.map((c) => (
                <button key={c.id} type="button" aria-pressed={qualityPick === c.id} onClick={() => { saveChoice(c.id); setNotice(null); changeQuality(c.id); }} className={clsx("rounded-sm border px-1 h-10 lg:h-8 text-xs", qualityPick === c.id ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink")}>{c.label}</button>
              ))}
            </div>
            <p className="text-xs text-muted mt-1.5 leading-snug">
              {qualityPick === "auto" && detected ? `Automaticky: ${LEVEL_LABEL[detected.level]}. ` : ""}Úspornější režim šetří baterii.
            </p>
          </div>
        </div>

        {selected && (
          <div className={clsx("border-t border-line pt-4 flex-col gap-2", page ? "hidden lg:flex max-lg:landscape:flex" : "hidden lg:flex")}>
            {actions(selected, false)}
            <div className="flex flex-wrap gap-2">
              {!renderActions && <Link href={`/podlaha/${selected.slug}`} className="btn btn-outline btn-sm">Detail podlahy</Link>}
              <SampleButton productId={selected.id} max={sampleMax} size="sm" compact />
            </div>
            <p className="text-xs text-muted leading-snug">Barvu ověřte na vzorku zdarma.</p>
          </div>
        )}
        {/* Na telefonu: vzorek a detail pod výběrem (hlavní akce je v liště) */}
        {selected && (
          <div className={clsx("lg:hidden flex flex-wrap items-center gap-2", page && "max-lg:landscape:hidden")}>
            <SampleButton productId={selected.id} max={sampleMax} size="sm" compact />
            {!renderActions && <Link href={`/podlaha/${selected.slug}`} className="btn btn-ghost btn-sm">Detail podlahy</Link>}
          </div>
        )}
      </aside>
      {!(variant === "inline") && bar}
    </div>
  );
}

/** Posune vodorovnou (nebo na desktopu svislou) řadu tak, aby vybraná položka byla uprostřed — bez posunu stránky. */
function centerPressed(list: HTMLElement | null, selector = '[aria-pressed="true"]') {
  if (!list) return;
  const el = list.querySelector<HTMLElement>(selector);
  if (list.scrollWidth > list.clientWidth + 1) list.scrollTo({ left: el ? el.offsetLeft - list.clientWidth / 2 + el.offsetWidth / 2 : 0, behavior: "smooth" });
  else if (list.scrollHeight > list.clientHeight + 1) list.scrollTo({ top: el ? el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2 : 0, behavior: "smooth" });
}
