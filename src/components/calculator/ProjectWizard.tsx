"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHydrated } from "@/store/cart";
import clsx from "clsx";
import type { PublicAccessory, PublicProduct, PublicSettings } from "@/lib/public";
import type { CalcOptions, CartItem, LayoutMode, RoomInput, WizardAnswers } from "@/lib/types";
import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LAYOUT_LABEL, LAYOUT_WASTE } from "@/lib/types";
import { calculateProject, DEFAULT_OPTIONS, emptyRoom, roomArea } from "@/lib/calc";
import { BUDGET_OPTIONS, budgetRange, describeRules, EMPTY_ANSWERS, passesHardRules, recommend, ROOM_LABEL, ROOM_OPTIONS, STYLE_OPTIONS } from "@/lib/guide";
import { estimateProductShipping } from "@/lib/shipping";
import { filtersToQuery } from "@/lib/catalog";
import { fmtCzk, fmtNum2 } from "@/lib/format";
import { useCart } from "@/store/cart";
import { CalcResultView } from "./CalcResultView";
import { SampleButton } from "@/components/product/SampleButton";
import { ArrowRight, Check, ChevronRight, Copy, Cube, Plus, Share, Trash } from "@/components/ui/icons";
import { preloadVisualizer, VisualizerDialog } from "@/components/visualizer/VisualizerDialog";
import { VIEW_FOR_ROOM } from "@/components/visualizer/decor";

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
}

const STEPS = ["Metry", "Rozpočet", "Místnost", "Požadavky", "Barva", "Nabídka"] as const;
const STORAGE_KEY = "vp-wizard-v1";
const num = (v: string) => { const n = parseFloat(v.replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : null; };
const str = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));

function makeRoom(n: number): RoomInput { return { ...emptyRoom(n), id: `r${n}` }; }

interface Persisted { rooms: RoomInput[]; answers: WizardAnswers; options: CalcOptions; selectedId: string | null; step: number }

function loadPersisted(): Persisted | null {
  try { const raw = sessionStorage.getItem(STORAGE_KEY); return raw ? (JSON.parse(raw) as Persisted) : null; } catch { return null; }
}

/** Obal: persist store i sessionStorage existují až na klientu — do hydratace ukážeme kostru. */
export function ProjectWizard(props: Props) {
  const hydrated = useHydrated();
  if (!hydrated) return <div className="space-y-4" aria-busy="true"><div className="h-9 w-2/3 max-w-md rounded bg-line/60" /><div className="h-40 rounded-md bg-line/40" /><div className="h-40 rounded-md bg-line/40" /></div>;
  return <WizardInner {...props} />;
}

function WizardInner({ products, accessories, settings, initial, lockedProductId, priceGuide }: Props) {
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
  const [saving, setSaving] = useState<"idle" | "saving" | "cart">("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const roomCounter = useRef(rooms.reduce((m, r) => Math.max(m, parseInt(r.id.replace(/\D/g, ""), 10) || 0), 0) + 1);

  useEffect(() => {
    if (locked) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ rooms, answers, options, selectedId, step } satisfies Persisted)); } catch { /* ignore */ }
  }, [rooms, answers, options, selectedId, step, locked]);

  const roomsForCalc = useMemo(() => rooms.map((r) => ({ ...r, floorHeating: answers.floorHeating })), [rooms, answers.floorHeating]);
  const totalArea = useMemo(() => rooms.reduce((s, r) => s + roomArea(r), 0), [rooms]);
  const totalWithWaste = useMemo(() => rooms.reduce((s, r) => s + roomArea(r) * (1 + LAYOUT_WASTE[r.layout]), 0), [rooms]);
  const hasArea = totalArea > 0;

  const rec = useMemo(() => {
    const r = recommend(products, answers, { needM2: totalWithWaste });
    if (locked && !r.results.some((x) => x.product.id === locked.id)) {
      r.results = [{ product: locked, score: 999, reason: "Podlaha, kterou jste si vybrali na její kartě." }, ...r.results].slice(0, 9);
    }
    return r;
  }, [products, answers, totalWithWaste, locked]);

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
  const next = () => go(locked && step === 0 ? 5 : Math.min(5, step + 1));
  const back = () => go(locked && step === 5 ? 0 : Math.max(0, step - 1));
  const patchAnswers = (p: Partial<WizardAnswers>) => { setShareUrl(null); setAnswers((a) => ({ ...a, ...p })); };
  const updateRoom = (id: string, patch: Partial<RoomInput>) => { setShareUrl(null); setRooms((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); };
  const addRoom = () => { setShareUrl(null); const n = roomCounter.current++; setRooms((rs) => [...rs, makeRoom(n)]); };
  const reset = () => { try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } setRooms([makeRoom(1)]); roomCounter.current = 2; setAnswers(EMPTY_ANSWERS); setOptions(DEFAULT_OPTIONS); setSelectedId(locked?.id ?? null); setShareUrl(null); go(0); setMaxStep(0); };

  async function save(): Promise<string | null> {
    if (!selected) return null;
    const res = await fetch("/api/calculations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId: selected.id, rooms: roomsForCalc, options, answers }) });
    if (!res.ok) return null;
    return ((await res.json()) as { id: string }).id;
  }
  async function onShare() { setSaving("saving"); const id = await save(); setSaving("idle"); if (id) setShareUrl(`${window.location.origin}/kalkulace/${id}`); }
  async function onAddToCart() {
    if (!selectedResult) return;
    setSaving("cart");
    const id = await save();
    const items: CartItem[] = selectedResult.lines.filter((l) => !l.skipped && l.qty > 0).map((l) => ({ kind: l.kind, id: l.refId, qty: l.qty }));
    addMany(items, id);
    router.push("/kosik");
  }

  const canContinue = step === 0 ? hasArea : step === 2 ? answers.roomKinds.length > 0 : true;
  const summary = [
    hasArea ? `${fmtNum2(totalArea)} m²` : null,
    step > 1 && answers.budget ? BUDGET_OPTIONS.find((b) => b.value === answers.budget)?.label : step > 1 ? "bez limitu" : null,
    step > 2 && answers.roomKinds.length ? answers.roomKinds.map((k) => ROOM_LABEL[k]).join(", ") : null,
    step > 4 ? (answers.style ? DECOR_TONE_LABEL[answers.style] : "barva libovolná") : null,
  ].filter(Boolean) as string[];

  return (
    <div className="pb-28 lg:pb-10">
      {/* Průběh */}
      <ol className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {STEPS.map((label, i) => {
          const hidden = locked && i > 0 && i < 5;
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

      <div className="mt-8 md:mt-10">
        {step === 0 && (
          <StepArea rooms={rooms} update={updateRoom} add={addRoom} remove={(id) => { setShareUrl(null); setRooms((rs) => rs.filter((r) => r.id !== id)); }} totalArea={totalArea} totalWithWaste={totalWithWaste} locked={locked} />
        )}
        {step === 1 && (
          <StepBudget value={answers.budget} onPick={(b) => { patchAnswers({ budget: b }); go(2); }} areaWithWaste={totalWithWaste} priceGuide={priceGuide} open={guideOpen} setOpen={setGuideOpen} />
        )}
        {step === 2 && (
          <StepRooms value={answers.roomKinds} onChange={(v) => patchAnswers({ roomKinds: v })} />
        )}
        {step === 3 && (
          <StepExtras answers={answers} patch={patchAnswers} products={products} />
        )}
        {step === 4 && (
          <StepStyle value={answers.style} onPick={(s) => { patchAnswers({ style: s }); go(5); }} products={products.filter((p) => p.status === "active" && p.stockM2 > 0 && passesHardRules(p, answers))} />
        )}
        {step === 5 && (
          <StepResult
            rec={rec} answers={answers} projectFor={projectFor} selected={selected} selectedResult={selectedResult} setSelectedId={(id) => { setShareUrl(null); setSelectedId(id); }}
            options={options} setOptions={(o) => { setShareUrl(null); setOptions(o); }} settings={settings} hasArea={hasArea} totalArea={totalArea}
            saving={saving} shareUrl={shareUrl} copied={copied} onShare={onShare} onAddToCart={onAddToCart} onCopy={async () => { if (shareUrl) { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); } }}
            goTo={go} reset={reset} locked={!!locked} layout={rooms[0]?.layout ?? "straight"}
          />
        )}
      </div>

      {/* Spodní lišta s navigací a souhrnem */}
      {step < 5 && (
        <div className="fixed lg:sticky bottom-0 inset-x-0 lg:inset-x-auto z-40 bg-bg/95 backdrop-blur border-t border-line lg:border lg:rounded-md lg:mt-10 lg:shadow-card">
          <div className="container lg:px-5 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0 text-sm">
              {summary.length ? <p className="truncate"><span className="text-muted">Projekt: </span>{summary.join(" · ")}</p> : <p className="text-muted">Zadejte rozměry místností.</p>}
              {hasArea && step === 0 && <p className="text-xs text-muted">s prořezem {fmtNum2(totalWithWaste)} m²</p>}
            </div>
            {step > 0 && <button type="button" className="btn btn-ghost" onClick={back}>Zpět</button>}
            <button type="button" className="btn btn-accent" disabled={!canContinue} onClick={next}>
              {step === 0 && locked ? "Zobrazit cenu projektu" : step === 4 ? (answers.style ? "Zobrazit nabídku" : "Barva nerozhoduje, zobrazit nabídku") : step === 1 && !answers.budget ? "Bez limitu, pokračovat" : "Pokračovat"} <ArrowRight className="h-4 w-4" />
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
      <p className="eyebrow mb-2">Krok {n} z 5</p>
      <h2 className="h2">{title}</h2>
      {text && <p className="lead mt-3">{text}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><span className="label">{label}</span>{children}</div>;
}

function OptionCard({ selected, onClick, label, hint, extra, image, check }: { selected: boolean; onClick: () => void; label: string; hint?: string; extra?: React.ReactNode; image?: string | null; check?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={clsx("text-left card card-hover overflow-hidden border-2 flex flex-col", selected ? "border-ink" : "border-line hover:border-line-strong")}>
      {image !== undefined && <div className="relative aspect-[5/3] bg-line">{image && <Image src={image} alt="" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />}</div>}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <p className="text-lg leading-tight">{label}</p>
          <span className={clsx("h-5 w-5 shrink-0 grid place-items-center border", check ? "rounded-sm" : "rounded-full", selected ? "bg-ink border-ink text-white" : "border-line-strong")}>{selected && <Check className="h-3.5 w-3.5" />}</span>
        </div>
        {hint && <p className="text-sm text-muted mt-1">{hint}</p>}
        {extra && <div className="mt-auto pt-3">{extra}</div>}
      </div>
    </button>
  );
}

/* Krok 1 — metry */
function StepArea({ rooms, update, add, remove, totalArea, totalWithWaste, locked }: { rooms: RoomInput[]; update: (id: string, p: Partial<RoomInput>) => void; add: () => void; remove: (id: string) => void; totalArea: number; totalWithWaste: number; locked: PublicProduct | null }) {
  return (
    <div>
      <StepHead n={1} title="Kolik metrů potřebujete?" text="Změřte délku a šířku každé místnosti. Když plochu znáte, zadejte ji rovnou. Prořez přidáme podle způsobu kladení: rovně +5 %, diagonálně +10 %, rybí kost +15 %." />
      {locked && (
        <div className="card mt-6 p-3 flex items-center gap-4 max-w-2xl">
          <div className="relative h-16 w-20 rounded-sm overflow-hidden bg-bg shrink-0">{locked.images.swatch && <Image src={locked.images.swatch} alt="" fill sizes="80px" className="object-cover" />}</div>
          <div className="flex-1 min-w-0"><p className="eyebrow">Počítáme s podlahou</p><p className="leading-tight">{locked.brand} {locked.decor}</p><p className="text-sm text-muted">{fmtCzk(locked.pricePerM2)}/m² · {fmtCzk(locked.pricePerPack)}/bal ({fmtNum2(locked.m2PerPack)} m²)</p></div>
          <Link href="/kalkulacka" className="btn btn-ghost btn-sm">Poradit s výběrem</Link>
        </div>
      )}
      <div className="mt-6 grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          {rooms.map((r) => {
            const area = roomArea(r);
            return (
              <div key={r.id} className="card p-4 md:p-5 fade-up">
                <div className="flex items-center gap-3">
                  <input className="input !py-1.5 font-medium" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} aria-label="Název místnosti" />
                  {rooms.length > 1 && <button type="button" className="btn btn-ghost btn-sm text-muted" onClick={() => remove(r.id)} aria-label="Odebrat místnost"><Trash className="h-4 w-4" /></button>}
                </div>
                <div className="mt-4 inline-flex rounded-sm border border-line-strong overflow-hidden text-sm">
                  <button type="button" className={clsx("px-3 py-2", r.mode === "dims" ? "bg-ink text-white" : "bg-white")} onClick={() => update(r.id, { mode: "dims" })}>Délka × šířka</button>
                  <button type="button" className={clsx("px-3 py-2", r.mode === "area" ? "bg-ink text-white" : "bg-white")} onClick={() => update(r.id, { mode: "area" })}>Znám plochu</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  {r.mode === "dims" ? (<>
                    <Field label="Délka (m)"><input inputMode="decimal" className="input text-lg" placeholder="5,2" value={str(r.lengthM)} onChange={(e) => update(r.id, { lengthM: num(e.target.value) })} autoFocus={rooms.length === 1} /></Field>
                    <Field label="Šířka (m)"><input inputMode="decimal" className="input text-lg" placeholder="3,8" value={str(r.widthM)} onChange={(e) => update(r.id, { widthM: num(e.target.value) })} /></Field>
                  </>) : (
                    <div className="col-span-2"><Field label="Plocha (m²)"><input inputMode="decimal" className="input text-lg" placeholder="19,76" value={str(r.areaM2)} onChange={(e) => update(r.id, { areaM2: num(e.target.value) })} autoFocus /></Field></div>
                  )}
                  <Field label="Počet dveří"><input inputMode="numeric" className="input text-lg" value={r.doors} onChange={(e) => update(r.id, { doors: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })} /></Field>
                  <Field label="Obvod (m) — volitelné"><input inputMode="decimal" className="input text-lg" placeholder={r.mode === "dims" && r.lengthM && r.widthM ? fmtNum2(2 * (r.lengthM + r.widthM)) : "dopočítáme"} value={str(r.perimeterM)} onChange={(e) => update(r.id, { perimeterM: num(e.target.value) })} /></Field>
                </div>
                <div className="mt-3">
                  <span className="label">Způsob kladení</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(LAYOUT_LABEL) as LayoutMode[]).map((m) => (
                      <button key={m} type="button" onClick={() => update(r.id, { layout: m })} className={clsx("rounded-sm border px-2 py-2 text-sm leading-tight", r.layout === m ? "border-ink bg-ink text-white" : "border-line-strong bg-white hover:border-ink")}>{LAYOUT_LABEL[m]}<br /><span className={clsx("text-xs", r.layout === m ? "text-white/70" : "text-muted")}>+{Math.round(LAYOUT_WASTE[m] * 100)} % prořez</span></button>
                    ))}
                  </div>
                </div>
                {area > 0 && <p className="text-sm text-muted mt-3">{fmtNum2(area)} m² → s prořezem {fmtNum2(area * (1 + LAYOUT_WASTE[r.layout]))} m²</p>}
              </div>
            );
          })}
          <button type="button" className="btn btn-outline w-full" onClick={add}><Plus className="h-4 w-4" /> Přidat další místnost</button>
        </div>
        <aside className="lg:col-span-4">
          <div className="panel lg:sticky lg:top-24">
            <p className="eyebrow">Váš projekt</p>
            <p className="text-4xl mt-2 leading-none">{fmtNum2(totalArea)} <span className="text-lg text-muted">m²</span></p>
            <p className="text-sm text-muted mt-2">s prořezem {fmtNum2(totalWithWaste)} m² · {rooms.length} {rooms.length === 1 ? "místnost" : rooms.length < 5 ? "místnosti" : "místností"} · {rooms.reduce((s, r) => s + r.doors, 0)} dveří</p>
            <div className="divider my-4" />
            <ul className="text-sm text-ink-soft space-y-2">
              <li>Balení zaokrouhlíme nahoru a přidáme 1 do rezervy (na opravy za pár let).</li>
              <li>Podložku, sokly, přechodové lišty, lepidlo i tmel spočítáme z obvodu a dveří.</li>
              <li>Doprava jde z hmotnosti — nad {fmtNum2(25)} m² podlahy zdarma.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* Krok 2 — rozpočet */
function StepBudget({ value, onPick, areaWithWaste, priceGuide, open, setOpen }: { value: WizardAnswers["budget"]; onPick: (b: WizardAnswers["budget"]) => void; areaWithWaste: number; priceGuide: Props["priceGuide"]; open: boolean; setOpen: (v: boolean) => void }) {
  const est = (min: number, max: number | null) => {
    if (areaWithWaste <= 0) return null;
    const lo = Math.round(min * areaWithWaste), hi = max ? Math.round(max * areaWithWaste) : null;
    return hi ? `${fmtCzk(lo)} – ${fmtCzk(hi)} za podlahu` : `od ${fmtCzk(lo)} za podlahu`;
  };
  return (
    <div>
      <StepHead n={2} title="Jaký máte rozpočet za m²?" text={`Rozpočet jen řadí nabídku — nic nevyřazuje natvrdo. U každého pásma vidíte, co to znamená pro vašich ${fmtNum2(areaWithWaste)} m² s prořezem (bez příslušenství a dopravy).`} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
        {BUDGET_OPTIONS.map((b) => (
          <OptionCard key={b.value} selected={value === b.value} onClick={() => onPick(b.value)} label={b.label} hint={b.hint} extra={est(b.min, b.max) && <p className="text-sm tabular-nums text-ink">{est(b.min, b.max)}</p>} />
        ))}
      </div>
      <button type="button" className={clsx("mt-3 text-left w-full card p-4 border-2", value === null ? "border-ink" : "border-line hover:border-line-strong")} onClick={() => onPick(null)}>
        <p>Nechám si poradit — rozpočet neřeším</p><p className="text-sm text-muted">Seřadíme podle vhodnosti a mírně zvýhodníme levnější.</p>
      </button>

      <div className="mt-10 max-w-3xl">
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

/* Krok 3 — místnosti */
function StepRooms({ value, onChange }: { value: WizardAnswers["roomKinds"]; onChange: (v: WizardAnswers["roomKinds"]) => void }) {
  const toggle = (k: WizardAnswers["roomKinds"][number]) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div>
      <StepHead n={3} title="Kam podlaha půjde?" text="Vyberte všechny místnosti v projektu. Platí nejpřísnější pravidlo — do koupelny a kuchyně jen 100 % voděodolné podlahy, do chodby a komerčních prostor vyšší třída zátěže." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
        {ROOM_OPTIONS.map((o) => <OptionCard key={o.value} check selected={value.includes(o.value)} onClick={() => toggle(o.value)} label={o.label} hint={o.hint} />)}
      </div>
    </div>
  );
}

/* Krok 4 — speciální požadavky */
function StepExtras({ answers, patch, products }: { answers: WizardAnswers; patch: (p: Partial<WizardAnswers>) => void; products: PublicProduct[] }) {
  const count = (a: WizardAnswers) => products.filter((p) => p.status === "active" && p.stockM2 > 0 && passesHardRules(p, a)).length;
  const items: { key: keyof Pick<WizardAnswers, "floorHeating" | "kidsPets" | "integratedUnderlay" | "diyClick">; label: string; hint: string }[] = [
    { key: "floorHeating", label: "Podlahové topení", hint: "Jen podlahy schválené výrobcem, podložka určená pod topení." },
    { key: "kidsPets", label: "Děti nebo zvířata", hint: "Nášlapná vrstva min. 0,4 mm a třída zátěže min. 32 — drápky, hračky, písek." },
    { key: "integratedUnderlay", label: "Chci integrovanou podložku", hint: "Ušetří jeden krok pokládky i položku v košíku. Upřednostníme, nevyřadíme." },
    { key: "diyClick", label: "Budu pokládat sám/sama", hint: "Jen click zámek — plovoucí pokládka bez lepení, zvládnete za víkend." },
  ];
  return (
    <div>
      <StepHead n={4} title="Něco speciálního?" text="Zaškrtněte, co platí. Každá volba zužuje výběr na podlahy, které to opravdu zvládnou. Můžete nechat prázdné." />
      <div className="grid sm:grid-cols-2 gap-3 mt-8">
        {items.map((it) => {
          const on = answers[it.key];
          const after = count({ ...answers, [it.key]: !on });
          return <OptionCard key={it.key} check selected={on} onClick={() => patch({ [it.key]: !on })} label={it.label} hint={it.hint} extra={<p className="text-xs text-muted">{on ? "Zapnuto" : `Po zapnutí vyhovuje ${after} podlah`}</p>} />;
        })}
      </div>
      <p className="text-sm text-muted mt-6">Aktuálně vyhovuje <strong className="text-ink">{count(answers)}</strong> podlah z nabídky.</p>
    </div>
  );
}

/* Krok 5 — barva */
function StepStyle({ value, onPick, products }: { value: WizardAnswers["style"]; onPick: (s: WizardAnswers["style"]) => void; products: PublicProduct[] }) {
  return (
    <div>
      <StepHead n={5} title="Jaký odstín se vám líbí?" text="Barva nabídku jen seřadí. Vzorky všech dekorů vám pošleme zdarma, rozhodnout se můžete až doma." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-8">
        {STYLE_OPTIONS.map((o) => {
          const sample = products.find((p) => p.decorTone === o.value && p.images.swatch) ?? null;
          const n = products.filter((p) => p.decorTone === o.value).length;
          return <OptionCard key={o.value} selected={value === o.value} onClick={() => onPick(o.value)} label={o.label} hint={o.hint} image={sample?.images.swatch ?? null} extra={<p className="text-xs text-muted">{n} {n === 1 ? "dekor" : n < 5 ? "dekory" : "dekorů"} v nabídce</p>} />;
        })}
      </div>
      <button type="button" className={clsx("mt-3 text-left w-full card p-4 border-2", value === null ? "border-ink" : "border-line hover:border-line-strong")} onClick={() => onPick(null)}>
        <p>Nerozhoduje — ukažte mi vše vhodné</p>
      </button>
    </div>
  );
}

/* Výsledek */
interface ResultProps {
  rec: ReturnType<typeof recommend>; answers: WizardAnswers; projectFor: Map<string, ReturnType<typeof calculateProject>>;
  selected: PublicProduct | null; selectedResult: ReturnType<typeof calculateProject> | null; setSelectedId: (id: string) => void;
  options: CalcOptions; setOptions: (o: CalcOptions) => void; settings: PublicSettings; hasArea: boolean; totalArea: number;
  saving: "idle" | "saving" | "cart"; shareUrl: string | null; copied: boolean; onShare: () => void; onAddToCart: () => void; onCopy: () => void;
  goTo: (s: number) => void; reset: () => void; locked: boolean; layout: LayoutMode;
}
function StepResult(p: ResultProps) {
  const { rec, answers, projectFor, selected, selectedResult, setSelectedId, options, setOptions, settings, hasArea, saving, shareUrl, copied, onShare, onAddToCart, onCopy, goTo, reset, locked, layout } = p;
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

  if (!hasArea) {
    return <div className="panel text-center py-12"><p className="lead">Nejdřív potřebujeme rozměry místností.</p><button type="button" className="btn btn-primary mt-5" onClick={() => goTo(0)}>Zadat metry</button></div>;
  }

  return (
    <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
      <div className="lg:col-span-7">
        <div className="fade-up">
          <p className="eyebrow mb-2">{locked ? "Cena vašeho projektu" : "Vaše nabídka"}</p>
          <h2 className="h2">{rec.results.length > 0 ? `${rec.results.length} ${rec.results.length === 1 ? "podlaha, která dává" : rec.results.length < 5 ? "podlahy, které dávají" : "podlah, které dávají"} smysl.` : "Pro tuto kombinaci nemáme vhodnou podlahu."}</h2>
          {(rules.length > 0 || answers.style) && (
            <p className="text-sm text-ink-soft mt-3 max-w-2xl">{rules.join(" ")}{answers.style ? ` Řazeno podle odstínu: ${DECOR_TONE_LABEL[answers.style].toLowerCase()}.` : ""}</p>
          )}
          {rec.relaxed.map((r) => <p key={r} className="notice notice-info text-sm mt-3 inline-block">{r}</p>)}
          {!locked && <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <button type="button" className="tag hover:border-ink" onClick={() => goTo(1)}>Rozpočet: {answers.budget ? BUDGET_OPTIONS.find((b) => b.value === answers.budget)?.label : "bez limitu"}</button>
            <button type="button" className="tag hover:border-ink" onClick={() => goTo(2)}>Místnost: {answers.roomKinds.map((k) => ROOM_LABEL[k]).join(", ") || "—"}</button>
            <button type="button" className="tag hover:border-ink" onClick={() => goTo(3)}>Požadavky: {[answers.floorHeating && "topení", answers.kidsPets && "děti/zvířata", answers.integratedUnderlay && "podložka", answers.diyClick && "svépomoc"].filter(Boolean).join(", ") || "žádné"}</button>
            <button type="button" className="tag hover:border-ink" onClick={() => goTo(4)}>Barva: {answers.style ? DECOR_TONE_LABEL[answers.style] : "libovolná"}</button>
          </div>}
          {rec.results.length > 0 && (
            <button type="button" onClick={() => setVizFor(selected?.id ?? rec.results[0].product.id)} onMouseEnter={preloadVisualizer} className="mt-5 w-full sm:w-auto flex items-center gap-3 rounded-md border border-line bg-surface px-4 py-3 text-left hover:border-ink transition-colors">
              <Cube className="h-6 w-6 shrink-0 text-accent" />
              <span><span className="block">Porovnat dekory v interiéru</span><span className="block text-xs text-muted">Modelový byt ve 3D — {answers.roomKinds.length ? `začneme v místnosti ${ROOM_LABEL[answers.roomKinds[0]]}` : "obývák, kuchyň, ložnice, koupelna"}</span></span>
              <ArrowRight className="h-4 w-4 ml-auto shrink-0" />
            </button>
          )}
        </div>

        {rec.results.length === 0 ? (
          <div className="panel mt-8">
            <p className="text-ink-soft">Zkuste uvolnit některý požadavek — nejčastěji pomůže vypnout „Budu pokládat sám“ nebo rozšířit rozpočet.</p>
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn btn-outline" onClick={() => goTo(3)}>Upravit požadavky</button><button type="button" className="btn btn-outline" onClick={() => goTo(1)}>Upravit rozpočet</button><Link href="/podlahy" className="btn btn-ghost">Celý katalog</Link></div>
          </div>
        ) : (
          <ol className="mt-8 space-y-3">
            {rec.results.map((r, i) => {
              const pr = projectFor.get(r.product.id);
              const on = selected?.id === r.product.id;
              const enough = pr ? pr.coveredAreaM2 <= r.product.stockM2 : true;
              return (
                <li key={r.product.id} className={clsx("card overflow-hidden border-2 transition-colors fade-up", on ? "border-ink" : "border-line")}>
                  <div className="flex gap-3 sm:gap-4 p-3 sm:p-4">
                    <Link href={`/podlaha/${r.product.slug}`} className="relative h-24 w-24 sm:h-32 sm:w-40 shrink-0 rounded-sm overflow-hidden bg-line">
                      {r.product.images.card && <Image src={r.product.images.card} alt={`${r.product.brand} ${r.product.decor}`} fill sizes="160px" className="object-cover" />}
                      {i === 0 && !locked && <span className="absolute top-1.5 left-1.5 tag tag-accent">Nejlepší shoda</span>}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="eyebrow truncate">{r.product.brand} · {r.product.collection}</p>
                      <p className="text-lg leading-tight mt-0.5"><Link href={`/podlaha/${r.product.slug}`} className="hover:underline underline-offset-4">{r.product.decor}</Link></p>
                      <p className="text-xs sm:text-sm text-muted mt-0.5">{FLOOR_TYPE_LABEL[r.product.type]} · {String(r.product.thicknessMm).replace(".", ",")} mm · nášlap {String(r.product.wearLayerMm).replace(".", ",")} mm · tř. {r.product.usageClass}{r.product.integratedUnderlay ? " · + podložka" : ""}</p>
                      <p className="hidden sm:block mt-2 text-sm text-ink-soft leading-snug border-l-2 border-accent pl-2.5">{r.reason}</p>
                      <div className="mt-2 sm:mt-3 flex flex-wrap items-end justify-between gap-2">
                        <div className="text-sm text-muted">{fmtCzk(r.product.pricePerM2)}/m² · {pr ? `${pr.packs} balení` : ""}</div>
                        <div className="text-right">
                          <p className="text-xl leading-none tabular-nums">{pr ? fmtCzk(pr.total) : "—"}</p>
                          <p className="text-[0.7rem] text-muted mt-1">celý projekt vč. příslušenství</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex items-center justify-between gap-2">
                    <span className={clsx("text-xs", enough ? "text-ok" : "text-warn")}>{enough ? `${fmtNum2(r.product.stockM2)} m² dostupných · dodání ${r.product.deliveryDays} dní` : `Dostupných jen ${fmtNum2(r.product.stockM2)} m² — zbytek doobjednáme`}</span>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-ghost btn-sm !px-2.5" onClick={() => setVizFor(r.product.id)} onMouseEnter={preloadVisualizer} title="Zobrazit v interiéru" aria-label={`Zobrazit ${r.product.decor} v interiéru`}><Cube className="h-4 w-4" /><span className="hidden md:inline">V interiéru</span></button>
                      <SampleButton productId={r.product.id} max={settings.samples.max} size="sm" />
                      <button type="button" className={clsx("btn btn-sm", on ? "btn-primary" : "btn-outline")} onClick={() => setSelectedId(r.product.id)}>{on ? <><Check className="h-4 w-4" /> Vybráno</> : "Vybrat"}</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          {!locked && <Link href={catalogHref} className="link">Zobrazit všech {rec.poolSize} vyhovujících v katalogu</Link>}
          <button type="button" className="link text-muted" onClick={reset}>Začít znovu</button>
        </div>
      </div>

      <aside className="lg:col-span-5">
        <div className="panel lg:sticky lg:top-24 fade-up">
          <p className="eyebrow">Rozpis projektu</p>
          {!selected || !selectedResult ? (
            <p className="text-muted mt-3">Vyberte podlahu z nabídky — rozpis se objeví tady.</p>
          ) : (
            <>
              <h3 className="h3 mt-1">{selected.brand} {selected.decor}</h3>
              <p className="text-sm text-muted">{fmtCzk(selected.pricePerM2)}/m² · {fmtCzk(selected.pricePerPack)}/balení ({fmtNum2(selected.m2PerPack)} m²)</p>
              <div className="mt-5"><CalcResultView result={selectedResult} /></div>
              <div className="mt-5 grid sm:grid-cols-2 gap-2 text-sm">
                <label className="check"><input type="checkbox" checked={options.reservePack} onChange={(e) => setOptions({ ...options, reservePack: e.target.checked })} /> +1 balení rezerva</label>
                <label className="check"><input type="checkbox" checked={options.includeUnderlay} onChange={(e) => setOptions({ ...options, includeUnderlay: e.target.checked })} /> Podložka</label>
                <label className="check"><input type="checkbox" checked={options.includeSkirting} onChange={(e) => setOptions({ ...options, includeSkirting: e.target.checked })} /> Sokly + lepidlo + tmel</label>
                <label className="check"><input type="checkbox" checked={options.includeTransitions} onChange={(e) => setOptions({ ...options, includeTransitions: e.target.checked })} /> Přechodové lišty</label>
              </div>
              {ship && (
                <p className="text-sm text-ink-soft mt-4">Doprava podlahy: {ship.free ? <strong className="text-ok">zdarma</strong> : <strong>{fmtCzk(ship.price)}</strong>} · {ship.methodLabel.toLowerCase()} · {fmtNum2(ship.weightKg)} kg{ship.estimated ? " (odhad)" : ""}. {ship.method === "pallet" ? "Dovoz ke krajnici, vynáška v košíku." : "Ke dveřím domu."}</p>
              )}
              <div className="mt-5 grid gap-2">
                <button type="button" className="btn btn-accent btn-lg w-full" disabled={saving !== "idle"} onClick={onAddToCart}>{saving === "cart" ? "Ukládám…" : "Vložit celý projekt do košíku"}</button>
                <button type="button" className="btn btn-outline w-full" disabled={saving !== "idle"} onClick={onShare}><Share className="h-4 w-4" /> {saving === "saving" ? "Ukládám…" : "Uložit a získat odkaz"}</button>
                {shareUrl && (
                  <div className="rounded-md bg-bg p-3 text-sm">
                    <p className="text-muted mb-1.5">Kalkulace je uložená. Odkaz pošlete partnerovi nebo si ho schovejte:</p>
                    <div className="flex gap-2"><input readOnly className="input !py-1.5 text-xs" value={shareUrl} onFocus={(e) => e.currentTarget.select()} /><button type="button" className="btn btn-primary btn-sm shrink-0" onClick={onCopy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button></div>
                  </div>
                )}
                <Link href={`/montaz?product=${selected.slug}&area=${selectedResult.totalAreaM2}`} className="btn btn-ghost w-full text-ink-soft">Chci k tomu i pokládku</Link>
              </div>
            </>
          )}
        </div>
      </aside>
      <VisualizerDialog
        open={vizFor !== null}
        onClose={() => setVizFor(null)}
        title="Porovnání v interiéru"
        subtitle={`${rec.results.length} dekorů z vaší nabídky · ceny za celý projekt`}
        products={rec.results.map((r) => r.product)}
        initialProductId={vizFor}
        initialView={answers.roomKinds.length ? VIEW_FOR_ROOM[answers.roomKinds[0]] : "living"}
        initialLayout={layout}
        sampleMax={settings.samples.max}
        priceLabel={(prod) => { const pr = projectFor.get(prod.id); return pr ? `${fmtCzk(pr.total)} celý projekt` : `${fmtCzk(prod.pricePerM2)}/m²`; }}
        renderActions={(prod) => prod.id === selected?.id
          ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setVizFor(null)}><Check className="h-4 w-4" /> Vybráno — zpět na rozpis</button>
          : <button type="button" className="btn btn-accent btn-sm" onClick={() => { setSelectedId(prod.id); setVizFor(null); }}>Vybrat tuto podlahu</button>}
      />
    </div>
  );
}
