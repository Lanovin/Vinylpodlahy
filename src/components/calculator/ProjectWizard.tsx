"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useHydrated } from "@/store/cart";
import clsx from "clsx";
import type { PublicAccessory, PublicProduct, PublicSettings } from "@/lib/public";
import type { CalcOptions, CartItem, LayoutMode, RoomInput, RoomKind, WizardAnswers } from "@/lib/types";
import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LAYOUT_LABEL, LAYOUT_WASTE } from "@/lib/types";
import { calculateProject, DEFAULT_OPTIONS, emptyRoom, roomArea } from "@/lib/calc";
import { BUDGET_OPTIONS, budgetRange, describeRules, EMPTY_ANSWERS, passesHardRules, recommend, ROOM_OPTIONS, STYLE_OPTIONS, WIZARD_RESULT_STEP } from "@/lib/guide";
import { estimateProductShipping } from "@/lib/shipping";
import { filtersToQuery } from "@/lib/catalog";
import { fmtCzk, fmtInt, fmtNum2, plural } from "@/lib/format";
import { useCart } from "@/store/cart";
import { CalcResultView } from "./CalcResultView";
import { SampleButton } from "@/components/product/SampleButton";
import { ArrowRight, Check, ChevronDown, ChevronRight, Copy, Cube, Plus, Share, Trash } from "@/components/ui/icons";
import { preloadVisualizer, VisualizerDialog, VisualizerEmbed } from "@/components/visualizer/VisualizerDialog";
import { VIEW_FOR_ROOM } from "@/components/visualizer/decor";
import type { ViewId } from "@/components/visualizer/engine/views";

export interface WizardInitial {
  rooms?: RoomInput[];
  options?: CalcOptions;
  answers?: WizardAnswers | null;
  productId?: string | null;
  step?: number;
}

interface Props {
  products: PublicProduct[];
  accessories: PublicAccessory[];
  settings: PublicSettings;
  initial?: WizardInitial | null;
  /** Produkt z karty („Spočítat s touto podlahou“) — přeskočí otázky, ptá se jen na metry. */
  lockedProductId?: string | null;
  priceGuide: { title: string; rows: { label: string; range: string; note: string }[] };
  /** Úvodní nadpis stránky — ukáže se jen na prvním kroku, dál by na telefonu zabral celou obrazovku před otázkou. */
  intro?: React.ReactNode;
}

/** Typ místnosti se vybírá čipem přímo u rozměrů (dřív samostatný krok). */
const STEPS = ["Metry", "Rozpočet", "Požadavky", "Barva", "Nabídka"] as const;
const RESULT = WIZARD_RESULT_STEP;
const QUESTIONS = STEPS.length - 1;
const STORAGE_KEY = "vp-wizard-v2";
const num = (v: string) => { const n = parseFloat(v.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : null; };
const str = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
const ROOM_CHIP: Record<RoomKind, string> = { living: "Obývák", bedroom: "Ložnice", kitchen: "Kuchyň", bathroom: "Koupelna", hallway: "Chodba", commercial: "Komerční" };
const ROOM_NAME = Object.fromEntries(ROOM_OPTIONS.map((o) => [o.value, o.label])) as Record<RoomKind, string>;
const ROOM_HINT = Object.fromEntries(ROOM_OPTIONS.map((o) => [o.value, o.hint])) as Record<RoomKind, string>;

function makeRoom(n: number, from?: RoomInput): RoomInput {
  return { ...emptyRoom(n), id: `r${n}`, kind: n === 1 ? "living" : null, ...(from ? { mode: from.mode, layout: from.layout } : {}) };
}

interface Persisted { rooms: RoomInput[]; answers: WizardAnswers; options: CalcOptions; selectedId: string | null; pinnedId?: string | null; step: number }

function loadPersisted(): Persisted | null {
  try { const raw = sessionStorage.getItem(STORAGE_KEY); return raw ? (JSON.parse(raw) as Persisted) : null; } catch { return null; }
}

/** Obal: persist store i sessionStorage existují až na klientu — do hydratace ukážeme kostru. */
export function ProjectWizard(props: Props) {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="space-y-4" aria-busy="true"><div className="h-9 w-2/3 max-w-md rounded bg-line/60" /><div className="h-40 rounded-md bg-line/40" /><div className="h-40 rounded-md bg-line/40" /></div>;
  return <WizardInner {...props} />;
}

function WizardInner({ products, accessories, settings, initial, lockedProductId, priceGuide, intro }: Props) {
  const router = useRouter();
  const addMany = useCart((s) => s.addMany);
  const locked = lockedProductId ? products.find((p) => p.id === lockedProductId) ?? null : null;
  // Rozpracovaný projekt přežije obnovení stránky (jen v tomto prohlížeči). Server‑side initial má přednost.
  const [persisted] = useState<Persisted | null>(() => (initial || locked ? null : loadPersisted()));

  const [step, setStep] = useState<number>(initial?.step ?? persisted?.step ?? 0);
  const [maxStep, setMaxStep] = useState<number>(initial?.step ?? persisted?.step ?? 0);
  const [rooms, setRooms] = useState<RoomInput[]>(initial?.rooms ?? (persisted?.rooms?.length ? persisted.rooms : [makeRoom(1)]));
  const [answers, setAnswers] = useState<WizardAnswers>(initial?.answers ?? (persisted?.answers ? { ...EMPTY_ANSWERS, ...persisted.answers } : EMPTY_ANSWERS));
  const [options, setOptions] = useState<CalcOptions>(initial?.options ?? persisted?.options ?? DEFAULT_OPTIONS);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.productId ?? locked?.id ?? persisted?.selectedId ?? null);
  /** Podlaha vybraná ve 3D bytě — ve výsledku je vždy první, i když by ji rozpočet nebo odstín odsunul. */
  const [pinnedId, setPinnedId] = useState<string | null>(persisted?.pinnedId ?? null);
  const [saving, setSaving] = useState<"idle" | "saving" | "cart">("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const roomCounter = useRef(rooms.reduce((m, r) => Math.max(m, parseInt(r.id.replace(/\D/g, ""), 10) || 0), 0) + 1);
  const focusRoom = useRef<string | null>(null);

  useEffect(() => {
    if (locked) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ rooms, answers, options, selectedId, pinnedId, step } satisfies Persisted)); } catch { /* ignore */ }
  }, [rooms, answers, options, selectedId, pinnedId, step, locked]);
  // Nová místnost: posunout na ni a dát kurzor do prvního pole.
  useEffect(() => {
    const id = focusRoom.current;
    if (!id) return;
    focusRoom.current = null;
    const el = document.getElementById(`room-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector<HTMLInputElement>("input[inputmode]")?.focus({ preventScroll: true });
  }, [rooms]);

  // Typy místností bereme z čipů u rozměrů; starší uložené kalkulace je mají jen v odpovědích.
  const kinds = useMemo(() => {
    const fromRooms = [...new Set(rooms.map((r) => r.kind).filter((k): k is RoomKind => !!k))];
    return fromRooms.length || rooms.some((r) => r.kind !== undefined) ? fromRooms : answers.roomKinds;
  }, [rooms, answers.roomKinds]);
  const eff = useMemo<WizardAnswers>(() => ({ ...answers, roomKinds: kinds }), [answers, kinds]);

  const roomsForCalc = useMemo(() => rooms.map((r) => ({ ...r, floorHeating: answers.floorHeating })), [rooms, answers.floorHeating]);
  const totalArea = useMemo(() => rooms.reduce((s, r) => s + roomArea(r), 0), [rooms]);
  const totalWithWaste = useMemo(() => rooms.reduce((s, r) => s + roomArea(r) * (1 + LAYOUT_WASTE[r.layout]), 0), [rooms]);
  const hasArea = totalArea > 0;
  const suitable = useMemo(() => products.filter((p) => p.status === "active" && p.stockM2 > 0 && passesHardRules(p, eff)), [products, eff]);

  const rec = useMemo(() => {
    const r = recommend(products, eff, { needM2: totalWithWaste });
    const pin = locked ?? (pinnedId ? products.find((p) => p.id === pinnedId) ?? null : null);
    if (pin) {
      const own = r.results.find((x) => x.product.id === pin.id);
      const entry = own ?? { product: pin, score: 999, reason: locked ? "Podlaha, kterou jste si vybrali na její kartě." : "Vybrali jste ji ve 3D bytě." };
      r.results = [entry, ...r.results.filter((x) => x.product.id !== pin.id)].slice(0, 9);
    }
    return r;
  }, [products, eff, totalWithWaste, locked, pinnedId]);

  const projectFor = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calculateProject>>();
    if (!hasArea) return m;
    for (const r of rec.results) m.set(r.product.id, calculateProject(r.product, roomsForCalc, options, accessories, settings));
    return m;
  }, [rec, roomsForCalc, options, accessories, settings, hasArea]);

  // Na výsledku je vždy něco vybráno — pokud volba nevyhovuje nabídce, platí první doporučení.
  const effectiveId = selectedId && rec.results.some((r) => r.product.id === selectedId) ? selectedId : rec.results[0]?.product.id ?? null;
  const selected = effectiveId ? products.find((p) => p.id === effectiveId) ?? null : null;
  const selectedResult = selected && hasArea ? projectFor.get(selected.id) ?? calculateProject(selected, roomsForCalc, options, accessories, settings) : null;

  const go = (s: number) => { setStep(s); setMaxStep((m) => Math.max(m, s)); setShareUrl(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const next = () => go(locked && step === 0 ? RESULT : Math.min(RESULT, step + 1));
  const back = () => go(locked && step === RESULT ? 0 : Math.max(0, step - 1));
  const patchAnswers = (p: Partial<WizardAnswers>) => { setShareUrl(null); setAnswers((a) => ({ ...a, ...p })); };
  const updateRoom = (id: string, patch: Partial<RoomInput>) => { setShareUrl(null); setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); };
  const setKind = (id: string, kind: RoomKind) => {
    setShareUrl(null);
    setRooms((rs) => {
      const same = rs.filter((r) => r.id !== id && r.kind === kind).length;
      return rs.map((r) => (r.id === id ? { ...r, kind, name: same ? `${ROOM_NAME[kind]} ${same + 1}` : ROOM_NAME[kind] } : r));
    });
  };
  const addRoom = () => { setShareUrl(null); const n = roomCounter.current++; const room = makeRoom(n, rooms[rooms.length - 1]); focusRoom.current = room.id; setRooms((rs) => [...rs, room]); };
  /** Kladení zvolené ve 3D bytě platí pro celý projekt (prořez i cena). */
  const setLayoutAll = (layout: LayoutMode) => { setShareUrl(null); setRooms((rs) => rs.map((r) => ({ ...r, layout }))); };
  const reset = () => { try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } setRooms([makeRoom(1)]); roomCounter.current = 2; setAnswers(EMPTY_ANSWERS); setOptions(DEFAULT_OPTIONS); setSelectedId(locked?.id ?? null); setPinnedId(null); setShareUrl(null); go(0); setMaxStep(0); };

  async function save(): Promise<string | null> {
    if (!selected) return null;
    const res = await fetch("/api/calculations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: selected.id, rooms: roomsForCalc, options, answers: eff }) });
    if (!res.ok) return null;
    return ((await res.json()) as { id: string }).id;
  }
  async function onShare() {
    setSaving("saving");
    const id = await save();
    setSaving("idle");
    if (!id) return;
    const url = `${window.location.origin}/kalkulace/${id}`;
    setShareUrl(url);
    // Na telefonu rovnou nativní sdílení (WhatsApp, e-mail…); odkaz zůstane vidět i pro zkopírování.
    if (navigator.share) { try { await navigator.share({ title: "Kalkulace podlahy", url }); } catch { /* zrušeno */ } }
  }
  async function onAddToCart() {
    if (!selectedResult) return;
    setSaving("cart");
    const id = await save();
    const items: CartItem[] = selectedResult.lines.filter((l) => !l.skipped && l.qty > 0).map((l) => ({ kind: l.kind, id: l.refId, qty: l.qty }));
    addMany(items, id);
    router.push("/kosik");
  }

  const canContinue = step === 0 ? hasArea : true;
  const summary = [
    hasArea ? `${fmtNum2(totalArea)} m²` : null,
    step > 1 && answers.budget ? BUDGET_OPTIONS.find((b) => b.value === answers.budget)?.label : step > 1 ? "bez limitu" : null,
    step > 0 && kinds.length ? kinds.map((k) => ROOM_CHIP[k]).join(", ") : null,
    step > 3 ? (answers.style ? DECOR_TONE_LABEL[answers.style] : "barva libovolná") : null,
  ].filter(Boolean) as string[];

  return (
    <div className="pb-28 lg:pb-10">
      {step === 0 ? intro : <h1 className="sr-only">Kalkulačka projektu</h1>}
      {/* Průběh: na telefonu tenký pruh otázek (s větší dotykovou plochou), od tabletu pilulky s názvy */}
      {!locked && step < RESULT && (
        <ol className="flex gap-1.5 sm:hidden -my-2" aria-label="Průběh">
          {STEPS.slice(0, QUESTIONS).map((label, i) => {
            const reachable = i <= maxStep;
            return <li key={label} className="flex-1"><button type="button" disabled={!reachable} onClick={() => go(i)} aria-label={`${label}${i === step ? " (aktuální krok)" : ""}`} aria-current={i === step ? "step" : undefined} className="block w-full py-2"><span className={clsx("block h-1.5 w-full rounded-full transition-colors", i === step ? "bg-accent" : i < step || reachable ? "bg-ink" : "bg-line-strong/60")} /></button></li>;
          })}
        </ol>
      )}
      <ol className="hidden sm:flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => {
          const hidden = locked && i > 0 && i < RESULT;
          if (hidden) return null;
          const reachable = i <= maxStep;
          return (
            <li key={label} className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button type="button" disabled={!reachable} onClick={() => reachable && go(i)} className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors", i === step ? "bg-ink text-white" : reachable ? "bg-surface border border-line hover:border-ink" : "text-muted")}>
                <span className={clsx("h-5 w-5 rounded-full grid place-items-center text-[0.7rem]", i === step ? "bg-white text-ink" : i < step ? "bg-ink text-white" : "border border-line-strong")}>{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>
                {label}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-line-strong" />}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 md:mt-10">
        {step === 0 && (
          <StepArea rooms={rooms} update={updateRoom} setKind={setKind} add={addRoom} remove={(id) => { setShareUrl(null); setRooms((rs) => rs.filter((r) => r.id !== id)); }} totalArea={totalArea} totalWithWaste={totalWithWaste} locked={locked} onSubmit={() => canContinue && next()} />
        )}
        {step === 1 && (
          <StepBudget value={answers.budget} onPick={(b) => patchAnswers({ budget: b })} areaWithWaste={totalWithWaste} priceGuide={priceGuide} open={guideOpen} setOpen={setGuideOpen} />
        )}
        {step === 2 && (
          <StepExtras answers={answers} patch={patchAnswers} />
        )}
        {step === 3 && (
          <StepStyle value={answers.style} onPick={(s) => patchAnswers({ style: s })} onSkip={() => { patchAnswers({ style: null }); go(RESULT); }}
            onChoose={(p) => { patchAnswers({ style: p.decorTone }); setPinnedId(p.id); setSelectedId(p.id); go(RESULT); }} onLayout={setLayoutAll}
            sampleMax={settings.samples.max} initialView={kinds.length ? VIEW_FOR_ROOM[kinds[0]] : "living"} layout={rooms[0]?.layout ?? "straight"} products={suitable} />
        )}
        {step === RESULT && (
          <StepResult
            rec={rec} answers={eff} projectFor={projectFor} selected={selected} selectedResult={selectedResult} setSelectedId={(id) => { setShareUrl(null); setSelectedId(id); }}
            options={options} setOptions={(o) => { setShareUrl(null); setOptions(o); }} settings={settings} hasArea={hasArea} totalArea={totalArea}
            saving={saving} shareUrl={shareUrl} copied={copied} onShare={onShare} onAddToCart={onAddToCart} onCopy={async () => { if (shareUrl) { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
            goTo={go} reset={reset} locked={locked} pinnedId={pinnedId} layout={rooms[0]?.layout ?? "straight"} onLayout={setLayoutAll}
          />
        )}
      </div>

      {/* Spodní lišta s navigací a souhrnem */}
      {step < RESULT && (
        <div className="fixed lg:sticky bottom-0 inset-x-0 lg:inset-x-auto z-40 bg-bg/95 backdrop-blur border-t border-line lg:border lg:rounded-md lg:mt-10 lg:shadow-card pb-[env(safe-area-inset-bottom)] lg:pb-0">
          <div className="container lg:px-5 py-2.5 flex items-center gap-2 sm:gap-3">
            {step > 0 && <button type="button" className="btn btn-ghost !px-0 w-11 sm:w-auto sm:!px-4 shrink-0" onClick={back} aria-label="Zpět"><ArrowRight className="h-5 w-5 rotate-180 sm:hidden" /><span className="hidden sm:inline">Zpět</span></button>}
            <div className="flex-1 min-w-0 text-sm leading-tight">
              {summary.length ? <p className="truncate">{summary[0]}<span className="hidden sm:inline">{summary.slice(1).map((x) => ` · ${x}`).join("")}</span></p> : <p className="text-muted">Zadejte rozměry.</p>}
              {hasArea && step === 0 && <p className="text-xs text-muted">s prořezem {fmtNum2(totalWithWaste)} m²</p>}
              {step === 2 && <p className="text-xs text-muted">Vyhovuje {suitable.length} {plural(suitable.length, "podlaha", "podlahy", "podlah")}</p>}
            </div>
            <button type="button" className="btn btn-accent shrink-0" disabled={!canContinue} onClick={next}>
              {step === 0 && locked ? "Zobrazit cenu" : step === 3 ? "Zobrazit nabídku" : step === 1 && !answers.budget ? "Přeskočit" : step === 2 && !answers.floorHeating && !answers.kidsPets && !answers.integratedUnderlay && !answers.diyClick ? "Nic z toho" : "Pokračovat"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function StepHead({ n, title, text }: { n: number; title: string; text?: string }) {
  return (
    <div className="max-w-2xl fade-up">
      <p className="eyebrow mb-1.5 sm:mb-2">Krok {n} z {QUESTIONS}</p>
      <h2 className="h2">{title}</h2>
      {text && <p className="text-ink-soft mt-2 sm:lead sm:mt-3">{text}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><span className="label">{label}</span>{children}</div>;
}

function OptionCard({ selected, onClick, label, hint, extra, image, check, badge }: { selected: boolean; onClick: () => void; label: string; hint?: string; extra?: React.ReactNode; image?: string | null; check?: boolean; badge?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={clsx("text-left card card-hover overflow-hidden border-2 flex flex-col", selected ? "border-ink" : "border-line hover:border-line-strong")}>
      {image !== undefined && <div className="relative aspect-[2/1] sm:aspect-[5/3] bg-line">{image && <Image src={image} alt="" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />}</div>}
      <div className="p-3 sm:p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <p className="sm:text-lg leading-tight">{label}</p>
          <span className={clsx("h-5 w-5 shrink-0 grid place-items-center border", check ? "rounded-sm" : "rounded-full", selected ? "bg-ink border-ink text-white" : "border-line-strong")}>{selected && <Check className="h-3.5 w-3.5" />}</span>
        </div>
        {badge && <p className="text-xs text-accent-strong mt-1">{badge}</p>}
        {hint && <p className="text-sm text-muted mt-1 leading-snug">{hint}</p>}
        {extra && <div className="mt-auto pt-2 sm:pt-3">{extra}</div>}
      </div>
    </button>
  );
}

/* Krok 1 — metry (a typ každé místnosti) */
function StepArea({ rooms, update, setKind, add, remove, totalArea, totalWithWaste, locked, onSubmit }: { rooms: RoomInput[]; update: (id: string, p: Partial<RoomInput>) => void; setKind: (id: string, k: RoomKind) => void; add: () => void; remove: (id: string) => void; totalArea: number; totalWithWaste: number; locked: PublicProduct | null; onSubmit: () => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      {/* Enter / „Přejít“ na klávesnici telefonu posune na další krok */}
      <button type="submit" className="sr-only" tabIndex={-1}>Pokračovat</button>
      <StepHead n={1} title="Kolik metrů potřebujete?" />
      {locked && (
        <div className="mt-5 max-w-2xl">
          <div className="card p-3 flex items-center gap-3">
            <div className="relative h-14 w-16 rounded-sm overflow-hidden bg-bg shrink-0">{locked.images.swatch && <Image src={locked.images.swatch} alt="" fill sizes="64px" className="object-cover" />}</div>
            <div className="flex-1 min-w-0 leading-tight"><p className="truncate">{locked.brand} {locked.decor}</p><p className="text-sm text-muted mt-0.5">{fmtCzk(locked.pricePerM2)}/m² · {fmtCzk(locked.pricePerPack)}/bal.</p></div>
          </div>
          <Link href="/kalkulacka" className="inline-flex items-center gap-1 h-10 text-sm text-muted hover:text-ink">Nevím — poradit s výběrem <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      )}
      <div className="mt-5 sm:mt-6 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 min-w-0 space-y-4">
          {rooms.map((r, idx) => <RoomCard key={r.id} r={r} first={idx === 0} canRemove={rooms.length > 1} update={update} setKind={setKind} remove={remove} />)}
          <button type="button" className="btn btn-outline w-full" onClick={add}><Plus className="h-4 w-4" /> Přidat další místnost</button>
        </div>
        <aside className="hidden lg:block lg:col-span-4">
          <div className="panel lg:sticky lg:top-24">
            <p className="eyebrow">Váš projekt</p>
            <p className="text-4xl mt-2 leading-none">{fmtNum2(totalArea)} <span className="text-lg text-muted">m²</span></p>
            <p className="text-sm text-muted mt-2">s prořezem {fmtNum2(totalWithWaste)} m² · {rooms.length} {plural(rooms.length, "místnost", "místnosti", "místností")} · {rooms.reduce((s, r) => s + r.doors, 0)} dveří</p>
            <div className="divider my-4" />
            <ul className="text-sm text-ink-soft space-y-2">
              <li>Balení zaokrouhlíme nahoru a přidáme 1 do rezervy.</li>
              <li>Podložku, lišty, lepidlo i tmel spočítáme z obvodu a dveří.</li>
              <li>Doprava podle hmotnosti — nad {fmtInt(25)} m² podlahy zdarma.</li>
            </ul>
          </div>
        </aside>
      </div>
    </form>
  );
}

function RoomCard({ r, first, canRemove, update, setKind, remove }: { r: RoomInput; first: boolean; canRemove: boolean; update: (id: string, p: Partial<RoomInput>) => void; setKind: (id: string, k: RoomKind) => void; remove: (id: string) => void }) {
  const [more, setMore] = useState(false);
  const area = roomArea(r);
  const perimeterAuto = r.mode === "dims" && r.lengthM && r.widthM ? fmtNum2(2 * (r.lengthM + r.widthM)) : null;
  return (
    <div id={`room-${r.id}`} className="card p-3.5 md:p-5 fade-up scroll-mt-24">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1" role="group" aria-label="Typ místnosti">
          {ROOM_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={r.kind === o.value} onClick={() => setKind(r.id, o.value)} className={clsx("shrink-0 h-9 rounded-full px-3.5 text-sm border transition-colors", r.kind === o.value ? "bg-ink text-white border-ink" : "bg-white border-line-strong hover:border-ink")}>{ROOM_CHIP[o.value]}</button>
          ))}
        </div>
        {canRemove && <button type="button" className="h-10 w-10 grid place-items-center shrink-0 text-muted hover:text-ink" onClick={() => remove(r.id)} aria-label={`Odebrat ${r.name}`}><Trash className="h-4 w-4" /></button>}
      </div>
      {r.kind && (r.kind === "bathroom" || r.kind === "kitchen" || r.kind === "hallway" || r.kind === "commercial") && <p className="text-xs text-muted mt-2">{ROOM_HINT[r.kind]}</p>}

      <div className="mt-3 grid grid-cols-2 rounded-sm border border-line-strong overflow-hidden text-sm sm:inline-grid">
        <button type="button" className={clsx("h-10 px-3", r.mode === "dims" ? "bg-ink text-white" : "bg-white")} onClick={() => update(r.id, { mode: "dims" })}>Délka × šířka</button>
        <button type="button" className={clsx("h-10 px-3", r.mode === "area" ? "bg-ink text-white" : "bg-white")} onClick={() => update(r.id, { mode: "area" })}>Znám plochu</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {r.mode === "dims" ? (<>
          <Field label="Délka (m)"><input inputMode="decimal" enterKeyHint="next" className="input text-lg" placeholder="5,2" value={str(r.lengthM)} onChange={(e) => update(r.id, { lengthM: num(e.target.value) })} autoFocus={first} /></Field>
          <Field label="Šířka (m)"><input inputMode="decimal" enterKeyHint="go" className="input text-lg" placeholder="3,8" value={str(r.widthM)} onChange={(e) => update(r.id, { widthM: num(e.target.value) })} /></Field>
        </>) : (
          <div className="col-span-2"><Field label="Plocha (m²)"><input inputMode="decimal" enterKeyHint="go" className="input text-lg" placeholder="19,76" value={str(r.areaM2)} onChange={(e) => update(r.id, { areaM2: num(e.target.value) })} autoFocus={first} /></Field></div>
        )}
      </div>
      <div className="mt-3">
        <span className="label">Kladení</span>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(LAYOUT_LABEL) as LayoutMode[]).map((m) => (
            <button key={m} type="button" onClick={() => update(r.id, { layout: m })} aria-pressed={r.layout === m} className={clsx("rounded-sm border px-1.5 py-1.5 min-h-11 text-sm leading-tight", r.layout === m ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink")}>{LAYOUT_LABEL[m]}<span className={clsx("block text-xs", r.layout === m ? "text-white/70" : "text-muted")}>+{Math.round(LAYOUT_WASTE[m] * 100)} %</span></button>
          ))}
        </div>
      </div>
      {/* Dveře a obvod většinou sedí — schované za jedním řádkem */}
      <button type="button" className="mt-2 w-full flex items-center justify-between gap-2 min-h-11 text-sm text-left" aria-expanded={more} onClick={() => setMore((v) => !v)}>
        <span className="text-ink-soft">{r.doors} {plural(r.doors, "dveře", "dveře", "dveří")} · obvod {r.perimeterM ? `${fmtNum2(r.perimeterM)} m` : perimeterAuto ? `${perimeterAuto} m` : "dopočítáme"}</span>
        <span className="inline-flex items-center gap-1 text-muted">Upřesnit <ChevronDown className={clsx("h-4 w-4 transition-transform", more && "rotate-180")} /></span>
      </button>
      {more && (
        <div className="grid grid-cols-2 gap-3 mt-1 fade-up">
          <Field label="Počet dveří"><input inputMode="numeric" enterKeyHint="next" className="input text-lg" value={r.doors} onChange={(e) => update(r.id, { doors: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })} /></Field>
          <Field label="Obvod (m)"><input inputMode="decimal" enterKeyHint="go" className="input text-lg" placeholder={perimeterAuto ?? "dopočítáme"} value={str(r.perimeterM)} onChange={(e) => update(r.id, { perimeterM: num(e.target.value) })} /></Field>
        </div>
      )}
      {area > 0 && <p className="text-sm text-muted mt-2">{fmtNum2(area)} m² → s prořezem {fmtNum2(area * (1 + LAYOUT_WASTE[r.layout]))} m²</p>}
    </div>
  );
}

/* Krok 2 — rozpočet */
function StepBudget({ value, onPick, areaWithWaste, priceGuide, open, setOpen }: { value: WizardAnswers["budget"]; onPick: (b: WizardAnswers["budget"]) => void; areaWithWaste: number; priceGuide: Props["priceGuide"]; open: boolean; setOpen: (v: boolean) => void }) {
  const est = (min: number, max: number | null) => {
    if (areaWithWaste <= 0) return null;
    const lo = Math.round(min * areaWithWaste), hi = max ? Math.round(max * areaWithWaste) : null;
    return hi ? (lo > 0 ? `${fmtInt(lo)}–${fmtCzk(hi)}` : `do ${fmtCzk(hi)}`) : `od ${fmtCzk(lo)}`;
  };
  return (
    <div>
      <StepHead n={2} title="Jaký máte rozpočet za m²?" text={areaWithWaste > 0 ? `Odhad jen za podlahu pro ${fmtNum2(areaWithWaste)} m².` : undefined} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-5 sm:mt-8">
        {BUDGET_OPTIONS.map((b) => (
          <OptionCard key={b.value} selected={value === b.value} onClick={() => onPick(value === b.value ? null : b.value)} label={b.label} badge={b.value === "400-700" ? "Nejčastější výběr" : undefined} extra={est(b.min, b.max) && <p className="text-sm tabular-nums text-ink">{est(b.min, b.max)}</p>} />
        ))}
      </div>

      <div className="mt-8 max-w-3xl hidden sm:block">
        <button type="button" className="link text-sm" onClick={() => setOpen(!open)}>{open ? "Skrýt" : "Zobrazit"}: {priceGuide.title}</button>
        {open && (
          <table className="spec mt-4 fade-up">
            <tbody>{priceGuide.rows.map((r) => <tr key={r.label}><th>{r.label}</th><td><span className="tabular-nums">{r.range}</span><span className="block text-xs text-muted">{r.note}</span></td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* Krok 3 — speciální požadavky */
function StepExtras({ answers, patch }: { answers: WizardAnswers; patch: (p: Partial<WizardAnswers>) => void }) {
  const items: { key: keyof Pick<WizardAnswers, "floorHeating" | "kidsPets" | "integratedUnderlay" | "diyClick">; label: string; hint: string }[] = [
    { key: "floorHeating", label: "Podlahové topení", hint: "Jen podlahy schválené na topení." },
    { key: "kidsPets", label: "Děti nebo zvířata", hint: "Odolnější nášlap, min. 0,4 mm." },
    { key: "integratedUnderlay", label: "Integrovaná podložka", hint: "Upřednostníme, nevyřadíme." },
    { key: "diyClick", label: "Budu pokládat sám/sama", hint: "Jen click zámek." },
  ];
  return (
    <div>
      <StepHead n={3} title="Něco speciálního?" text="Nepovinné — zaškrtněte, co platí." />
      <div className="grid sm:grid-cols-2 gap-2.5 sm:gap-3 mt-5 sm:mt-8">
        {items.map((it) => <OptionCard key={it.key} check selected={answers[it.key]} onClick={() => patch({ [it.key]: !answers[it.key] })} label={it.label} hint={it.hint} />)}
      </div>
    </div>
  );
}

/* Krok 4 — barva */
function StepStyle({ value, onPick, onSkip, onChoose, onLayout, products, sampleMax, initialView, layout }: { value: WizardAnswers["style"]; onPick: (s: WizardAnswers["style"]) => void; onSkip: () => void; onChoose: (p: PublicProduct) => void; onLayout: (l: LayoutMode) => void; products: PublicProduct[]; sampleMax: number; initialView: ViewId; layout: LayoutMode }) {
  const [viz, setViz] = useState(false);
  const vizRef = useRef<HTMLDivElement>(null);
  // Byt je pod kartami odstínů — po otevření k němu sjedeme.
  useEffect(() => { if (viz) vizRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [viz]);
  return (
    <div>
      <StepHead n={4} title="Jaký odstín se vám líbí?" text="Jen seřadí nabídku." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mt-5 sm:mt-8">
        {STYLE_OPTIONS.map((o) => {
          const sample = products.find((p) => p.decorTone === o.value && p.images.swatch) ?? null;
          const n = products.filter((p) => p.decorTone === o.value).length;
          return <OptionCard key={o.value} selected={value === o.value} onClick={() => onPick(value === o.value ? null : o.value)} label={o.label} image={sample?.images.swatch ?? null} extra={<p className="text-xs text-muted">{n} {plural(n, "dekor", "dekory", "dekorů")}</p>} />;
        })}
      </div>
      <button type="button" className="mt-2.5 sm:mt-3 w-full card min-h-12 px-4 py-3 border-2 border-dashed border-line hover:border-ink transition-colors flex items-center justify-between gap-2 text-left" onClick={onSkip}>
        Barva nerozhoduje — ukažte vše vhodné <ArrowRight className="h-4 w-4 shrink-0" />
      </button>

      {products.length > 0 && (
        <div className="mt-6 sm:mt-8 border-t border-line pt-5 sm:pt-6">
          {!viz ? (
            <button type="button" onClick={() => setViz(true)} onMouseEnter={preloadVisualizer} onFocus={preloadVisualizer} onPointerDown={preloadVisualizer} className="w-full sm:w-auto flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 text-left hover:border-ink transition-colors">
              <Cube className="h-6 w-6 shrink-0 text-accent" />
              <span className="flex-1"><span className="block">Vyzkoušet odstíny ve 3D bytě</span><span className="block text-xs text-muted">{products.length} {plural(products.length, "vhodný dekor", "vhodné dekory", "vhodných dekorů")}</span></span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          ) : (
            <div ref={vizRef} className="scroll-mt-20">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-lg">Odstíny ve 3D bytě</p>
                <button type="button" className="h-10 px-2 text-sm text-muted hover:text-ink" onClick={() => setViz(false)}>Skrýt</button>
              </div>
              <VisualizerEmbed
                inline
                products={products}
                initialProductId={value ? products.find((p) => p.decorTone === value)?.id ?? null : null}
                initialView={initialView}
                initialLayout={layout}
                sampleMax={sampleMax}
                onLayoutChange={onLayout}
                renderActions={(p) => <button type="button" className="btn btn-accent btn-sm" onClick={() => onChoose(p)}>Ukázat cenu <ArrowRight className="h-4 w-4" /></button>}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Výsledek */
interface ResultProps {
  rec: ReturnType<typeof recommend>; answers: WizardAnswers; projectFor: Map<string, ReturnType<typeof calculateProject>>;
  selected: PublicProduct | null; selectedResult: ReturnType<typeof calculateProject> | null; setSelectedId: (id: string) => void;
  options: CalcOptions; setOptions: (o: CalcOptions) => void; settings: PublicSettings; hasArea: boolean; totalArea: number;
  saving: "idle" | "saving" | "cart"; shareUrl: string | null; copied: boolean; onShare: () => void; onAddToCart: () => void; onCopy: () => void;
  goTo: (s: number) => void; reset: () => void; locked: PublicProduct | null; pinnedId: string | null; layout: LayoutMode; onLayout: (l: LayoutMode) => void;
}
function StepResult(p: ResultProps) {
  const { rec, answers, projectFor, selected, selectedResult, setSelectedId, options, setOptions, settings, hasArea, saving, shareUrl, copied, onShare, onAddToCart, onCopy, goTo, reset, locked, pinnedId, layout, onLayout } = p;
  // Vizualizace v modelovém bytě: dekory z nabídky vedle sebe, s cenou celého projektu.
  const [vizFor, setVizFor] = useState<string | null>(null);
  const rules = describeRules(answers);
  const [bmin, bmax] = budgetRange(answers.budget);
  const wet = answers.roomKinds.includes("bathroom") || answers.roomKinds.includes("kitchen");
  const catalogHref = `/podlahy${filtersToQuery({
    tone: answers.style ? [answers.style] : [], floorHeating: answers.floorHeating ? true : null, waterproof: wet ? true : null, lock: answers.diyClick ? ["click"] : [],
    priceMin: answers.budget && bmin > 0 ? bmin : null, priceMax: answers.budget && Number.isFinite(bmax) ? bmax : null,
    wear: answers.kidsPets ? [0.4, 0.55] : [], usage: answers.roomKinds.includes("commercial") ? [33, 42] : answers.kidsPets || answers.roomKinds.includes("hallway") ? [32, 33, 42] : [],
  })}`;
  const ship = selected && selectedResult && selectedResult.packs > 0 ? estimateProductShipping(selected, selectedResult.packs, settings) : null;
  const extras = [answers.floorHeating && "topení", answers.kidsPets && "děti/zvířata", answers.integratedUnderlay && "podložka", answers.diyClick && "svépomoc"].filter(Boolean).join(", ");

  if (!hasArea) {
    return <div className="panel text-center py-12"><p className="lead">Nejdřív potřebujeme rozměry místností.</p><button type="button" className="btn btn-primary mt-5" onClick={() => goTo(0)}>Zadat metry</button></div>;
  }

  const vizButton = rec.results.length > 0 && (
    <button type="button" onClick={() => setVizFor(selected?.id ?? rec.results[0].product.id)} onMouseEnter={preloadVisualizer} onPointerDown={preloadVisualizer} className="w-full sm:w-auto flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 text-left hover:border-ink transition-colors">
      <Cube className="h-6 w-6 shrink-0 text-accent" />
      <span><span className="block">Porovnat dekory ve 3D bytě</span><span className="block text-xs text-muted">U každého cena za celý projekt</span></span>
      <ArrowRight className="h-4 w-4 ml-auto shrink-0" />
    </button>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-8 lg:gap-10">
      <div className="lg:col-span-7 min-w-0">
        <div className="fade-up">
          <p className="eyebrow mb-1.5 sm:mb-2">{locked ? "Cena vašeho projektu" : "Vaše nabídka"}</p>
          <h2 className="h2">{locked ? `Cena s podlahou ${locked.decor}` : rec.results.length > 0 ? `${rec.results.length} ${plural(rec.results.length, "podlaha, která dává", "podlahy, které dávají", "podlah, které dávají")} smysl.` : "Pro tuto kombinaci nemáme vhodnou podlahu."}</h2>
          {!locked && (rules.length > 0 || answers.style) && (
            <p className="hidden sm:block text-sm text-ink-soft mt-3 max-w-2xl">{rules.join(" ")}{answers.style ? ` Řazeno podle odstínu: ${DECOR_TONE_LABEL[answers.style].toLowerCase()}.` : ""}</p>
          )}
          {rec.relaxed.map((r) => <p key={r} className="notice notice-info text-sm mt-3 inline-block">{r}</p>)}
          {!locked && <div className="mt-3 sm:mt-4 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap text-sm">
            {[
              { s: 1, t: answers.budget ? BUDGET_OPTIONS.find((b) => b.value === answers.budget)?.label : "Rozpočet bez limitu" },
              { s: 0, t: answers.roomKinds.map((k) => ROOM_CHIP[k]).join(", ") || "Místnost" },
              { s: 2, t: extras ? `Požadavky: ${extras}` : "Bez požadavků" },
              { s: 3, t: answers.style ? DECOR_TONE_LABEL[answers.style] : "Barva libovolná" },
            ].map((x) => <button key={x.s} type="button" className="tag shrink-0 h-9 !px-3 !normal-case !tracking-normal !text-sm hover:border-ink whitespace-nowrap" onClick={() => goTo(x.s)}>{x.t}</button>)}
          </div>}
          <div className="hidden lg:block mt-5">{vizButton}</div>
        </div>

        {rec.results.length === 0 ? (
          <div className="panel mt-8">
            <p className="text-ink-soft">Zkuste uvolnit některý požadavek — nejčastěji pomůže vypnout „Budu pokládat sám“ nebo rozšířit rozpočet.</p>
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn btn-outline" onClick={() => goTo(2)}>Upravit požadavky</button><button type="button" className="btn btn-outline" onClick={() => goTo(1)}>Upravit rozpočet</button><Link href="/podlahy" className="btn btn-ghost">Celý katalog</Link></div>
          </div>
        ) : (
          <ol className="mt-5 sm:mt-8 space-y-3">
            {rec.results.map((r, i) => {
              const pr = projectFor.get(r.product.id);
              const on = selected?.id === r.product.id;
              const enough = pr ? pr.coveredAreaM2 <= r.product.stockM2 : true;
              return (
                <Fragment key={r.product.id}>
                  {locked && i === 1 && <li className="pt-4 text-lg">Podobné podlahy</li>}
                  <li className={clsx("card overflow-hidden border-2 transition-colors fade-up", on ? "border-ink" : "border-line")}>
                    {/* Ťuknutí na kartu = vybrat (rozpis a lišta se přepočítají) */}
                    <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 cursor-pointer" onClick={() => setSelectedId(r.product.id)}>
                      <div className="relative h-24 w-24 sm:h-32 sm:w-40 shrink-0 rounded-sm overflow-hidden bg-line">
                        {r.product.images.card && <Image src={r.product.images.card} alt={`${r.product.brand} ${r.product.decor}`} fill sizes="160px" className="object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="eyebrow truncate">{i === 0 && !locked && <span className="text-accent-strong">{r.product.id === pinnedId ? "Vybráno ve 3D" : "Nejlepší shoda"} · </span>}{r.product.brand} · {r.product.collection}</p>
                        <p className="text-lg leading-tight mt-0.5"><Link href={`/podlaha/${r.product.slug}`} className="hover:underline underline-offset-4" onClick={(e) => e.stopPropagation()}>{r.product.decor}</Link></p>
                        <p className="text-xs sm:text-sm text-muted mt-0.5 truncate sm:whitespace-normal">{FLOOR_TYPE_LABEL[r.product.type]} · {String(r.product.thicknessMm).replace(".", ",")} mm · nášlap {String(r.product.wearLayerMm).replace(".", ",")} mm · tř. {r.product.usageClass}{r.product.integratedUnderlay ? " · + podložka" : ""}</p>
                        {r.reason && <p className="mt-1.5 text-xs sm:text-sm text-ink-soft leading-snug border-l-2 border-accent pl-2.5 line-clamp-2 sm:line-clamp-none">{r.reason}</p>}
                        <p className="mt-2 text-xl leading-none tabular-nums">{pr ? fmtCzk(pr.total) : "—"} <span className="text-xs text-muted">vč. příslušenství</span></p>
                        <p className="text-xs text-muted mt-1">{fmtCzk(r.product.pricePerM2)}/m²{pr ? ` · ${pr.packs} bal.` : ""} · dodání {r.product.deliveryDays} dní</p>
                        {!enough && <p className="text-xs text-warn mt-1">Skladem jen {fmtInt(r.product.stockM2)} m² — zbytek doobjednáme</p>}
                      </div>
                    </div>
                    <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex gap-2 justify-end">
                      <button type="button" className="btn btn-ghost btn-sm !px-3" onClick={() => setVizFor(r.product.id)} onMouseEnter={preloadVisualizer} onPointerDown={preloadVisualizer} title="Zobrazit ve 3D bytě" aria-label={`Zobrazit ${r.product.decor} ve 3D bytě`}><Cube className="h-4 w-4" /><span className="hidden md:inline">Ve 3D</span></button>
                      <SampleButton productId={r.product.id} max={settings.samples.max} size="sm" compact />
                      <button type="button" className={clsx("btn btn-sm", on ? "btn-primary" : "btn-outline")} onClick={() => setSelectedId(r.product.id)}>{on ? <><Check className="h-4 w-4" /> Vybráno</> : "Vybrat"}</button>
                    </div>
                  </li>
                  {i === 0 && <li className="lg:hidden">{vizButton}</li>}
                </Fragment>
              );
            })}
          </ol>
        )}
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {!locked && <Link href={catalogHref} className="link py-2">Všech {rec.poolSize} vyhovujících v katalogu</Link>}
          <button type="button" className="link text-muted py-2" onClick={reset}>Začít znovu</button>
        </div>
      </div>

      <aside className="lg:col-span-5 min-w-0">
        <div id="rozpis" className="panel lg:sticky lg:top-24 fade-up scroll-mt-20">
          <p className="eyebrow">Rozpis projektu</p>
          {!selected || !selectedResult ? (
            <p className="text-muted mt-3">Vyberte podlahu z nabídky — rozpis se objeví tady.</p>
          ) : (
            <>
              <h3 className="h3 mt-1">{selected.brand} {selected.decor}</h3>
              <p className="text-sm text-muted">{fmtCzk(selected.pricePerM2)}/m² · {fmtCzk(selected.pricePerPack)}/balení ({fmtNum2(selected.m2PerPack)} m²)</p>
              <div className="mt-4 sm:mt-5"><CalcResultView result={selectedResult} /></div>
              <div className="mt-4 grid sm:grid-cols-2 gap-x-3 text-sm">
                <label className="check min-h-11"><input type="checkbox" checked={options.reservePack} onChange={(e) => setOptions({ ...options, reservePack: e.target.checked })} /> +1 balení rezerva</label>
                <label className="check min-h-11"><input type="checkbox" checked={options.includeUnderlay} onChange={(e) => setOptions({ ...options, includeUnderlay: e.target.checked })} /> Podložka</label>
                <label className="check min-h-11"><input type="checkbox" checked={options.includeSkirting} onChange={(e) => setOptions({ ...options, includeSkirting: e.target.checked })} /> Sokly + lepidlo + tmel</label>
                <label className="check min-h-11"><input type="checkbox" checked={options.includeTransitions} onChange={(e) => setOptions({ ...options, includeTransitions: e.target.checked })} /> Přechodové lišty</label>
              </div>
              {ship && (
                <p className="text-sm text-ink-soft mt-3">Doprava podlahy: {ship.free ? <strong className="text-ok">zdarma</strong> : <strong>{fmtCzk(ship.price)}</strong>} · {ship.methodLabel.toLowerCase()}. {ship.method === "pallet" ? "Ke krajnici, vynáška v košíku." : "Ke dveřím domu."}</p>
              )}
              <div className="mt-5 grid gap-2">
                <button type="button" className="btn btn-accent btn-lg w-full" disabled={saving !== "idle"} onClick={onAddToCart}>{saving === "cart" ? "Ukládám…" : "Vložit celý projekt do košíku"}</button>
                <button type="button" className="btn btn-outline w-full" disabled={saving !== "idle"} onClick={onShare}><Share className="h-4 w-4" /> {saving === "saving" ? "Ukládám…" : "Uložit a sdílet odkaz"}</button>
                {shareUrl && (
                  <div className="rounded-md bg-bg p-3 text-sm">
                    <p className="text-muted mb-1.5">Kalkulace je uložená pod odkazem:</p>
                    <div className="flex gap-2"><input readOnly className="input !py-1.5 text-xs" value={shareUrl} onFocus={(e) => e.currentTarget.select()} /><button type="button" className="btn btn-primary btn-sm shrink-0" onClick={onCopy}>{copied ? <><Check className="h-4 w-4" /> Zkopírováno</> : <><Copy className="h-4 w-4" /> Kopírovat</>}</button></div>
                  </div>
                )}
                <Link href={`/montaz?product=${selected.slug}&area=${selectedResult.totalAreaM2}`} className="btn btn-ghost w-full text-ink-soft">Chci k tomu i pokládku</Link>
              </div>
            </>
          )}
        </div>
      </aside>
      {selected && selectedResult && rec.results.length > 0 && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-bg/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
          <div className="container py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0 leading-tight">
              <p className="text-lg tabular-nums">{fmtCzk(selectedResult.total)}</p>
              <p className="text-xs text-muted truncate">{ship ? (ship.free ? "doprava zdarma" : `+ doprava ${fmtCzk(ship.price)}`) : "vč. příslušenství"} · {selected.decor}</p>
            </div>
            <button type="button" className="btn btn-ghost !px-3 shrink-0" onClick={() => document.getElementById("rozpis")?.scrollIntoView({ behavior: "smooth" })}>Rozpis</button>
            <button type="button" className="btn btn-accent shrink-0" disabled={saving !== "idle"} onClick={onAddToCart}>{saving === "cart" ? "Ukládám…" : "Do košíku"}</button>
          </div>
        </div>
      )}
      <VisualizerDialog
        open={vizFor !== null}
        onClose={() => setVizFor(null)}
        title="Porovnání ve 3D bytě"
        subtitle={`${rec.results.length} dekorů z vaší nabídky · ceny za celý projekt`}
        products={rec.results.map((r) => r.product)}
        initialProductId={vizFor}
        initialView={answers.roomKinds.length ? VIEW_FOR_ROOM[answers.roomKinds[0]] : "living"}
        initialLayout={layout}
        sampleMax={settings.samples.max}
        onLayoutChange={onLayout}
        priceLabel={(prod) => { const pr = projectFor.get(prod.id); return pr ? fmtCzk(pr.total) : `${fmtCzk(prod.pricePerM2)}/m²`; }}
        renderActions={(prod) => prod.id === selected?.id
          ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setVizFor(null)}><Check className="h-4 w-4" /> Vybráno</button>
          : <button type="button" className="btn btn-accent btn-sm" onClick={() => { setSelectedId(prod.id); setVizFor(null); }}>Vybrat tuto</button>}
      />
    </div>
  );
}
