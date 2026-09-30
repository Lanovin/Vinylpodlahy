import type { BudgetBand, DecorTone, RoomKind, WizardAnswers } from "./types";
import type { PublicProduct as Product } from "./public";
import { FLOOR_TYPE_LABEL } from "./types";

export type { RoomKind, BudgetBand, WizardAnswers };

export const EMPTY_ANSWERS: WizardAnswers = {
  roomKinds: [],
  budget: null,
  style: null,
  floorHeating: false,
  kidsPets: false,
  integratedUnderlay: false,
  diyClick: false,
};

/** Index kroku „Nabídka“ v průvodci kalkulačky (Metry, Rozpočet, Požadavky, Barva, Nabídka). */
export const WIZARD_RESULT_STEP = 4;

export const ROOM_OPTIONS: { value: RoomKind; label: string; hint: string }[] = [
  { value: "living", label: "Obývací pokoj", hint: "Střední zátěž, záleží na vzhledu" },
  { value: "bedroom", label: "Ložnice", hint: "Nízká zátěž, teplý a tichý došlap" },
  { value: "kitchen", label: "Kuchyň", hint: "Voda a pády nádobí — jen voděodolné" },
  { value: "bathroom", label: "Koupelna", hint: "Stojící voda — jen SPC nebo lepený vinyl" },
  { value: "hallway", label: "Chodba / předsíň", hint: "Písek a boty — třída 32 a výš" },
  { value: "commercial", label: "Komerční prostor", hint: "Kancelář, obchod — třída 33 a výš" },
];

export const BUDGET_OPTIONS: { value: BudgetBand; label: string; hint: string; min: number; max: number | null }[] = [
  { value: "lt400", label: "do 400 Kč/m²", hint: "Ekonomická volba, lepený vinyl a základní SPC", min: 0, max: 400 },
  { value: "400-700", label: "400–700 Kč/m²", hint: "Nejčastější výběr — SPC click s podložkou", min: 400, max: 700 },
  { value: "700-1000", label: "700–1 000 Kč/m²", hint: "Silnější nášlap, vyšší třída zátěže", min: 700, max: 1000 },
  { value: "gt1000", label: "nad 1 000 Kč/m²", hint: "Prémiové kolekce, nášlap 0,55 mm, rybí kost", min: 1000, max: null },
];

export const STYLE_OPTIONS: { value: DecorTone; label: string; hint: string }[] = [
  { value: "light-oak", label: "Světlý dub", hint: "Vzdušné, skandinávské, opticky zvětší" },
  { value: "dark-wood", label: "Tmavé dřevo", hint: "Útulné, elegantní, skryje prach" },
  { value: "grey", label: "Šedá", hint: "Moderní, neutrální k jakémukoli nábytku" },
  { value: "stone", label: "Kámen a beton", hint: "Industriální, minimalistické, do koupelen" },
];

export const ROOM_LABEL: Record<RoomKind, string> = {
  living: "obývací pokoj", bedroom: "ložnice", kitchen: "kuchyň", bathroom: "koupelna", hallway: "chodba", commercial: "komerční prostor",
};

export function budgetRange(b: BudgetBand | null): [number, number] {
  const o = BUDGET_OPTIONS.find((x) => x.value === b);
  return o ? [o.min, o.max ?? Number.POSITIVE_INFINITY] : [0, Number.POSITIVE_INFINITY];
}

export interface GuideResult {
  product: Product;
  reason: string;
  score: number;
}

/** Tvrdá pravidla, která produkt musí splnit (nezávisle na rozpočtu a barvě). */
export function passesHardRules(p: Product, a: WizardAnswers): boolean {
  const wet = a.roomKinds.includes("bathroom") || a.roomKinds.includes("kitchen");
  if (wet && !(p.type === "spc" || p.type === "vinyl-glue")) return false;
  if (a.floorHeating && !p.floorHeating) return false;
  if (a.kidsPets && (p.wearLayerMm < 0.4 || p.usageClass < 32)) return false;
  if (a.roomKinds.includes("commercial") && p.usageClass < 33) return false;
  if (a.roomKinds.includes("hallway") && p.usageClass < 32) return false;
  if (a.diyClick && p.lock !== "click") return false;
  return true;
}

/** Lidsky čitelný souhrn tvrdých pravidel — zobrazuje se nad výsledky. */
export function describeRules(a: WizardAnswers): string[] {
  const out: string[] = [];
  if (a.roomKinds.includes("bathroom") || a.roomKinds.includes("kitchen")) out.push("Jen 100 % voděodolné: SPC nebo lepený vinyl.");
  if (a.floorHeating) out.push("Jen podlahy schválené na podlahové topení.");
  if (a.kidsPets) out.push("Nášlapná vrstva min. 0,4 mm a třída zátěže min. 32.");
  if (a.roomKinds.includes("commercial")) out.push("Třída zátěže min. 33 (komerční).");
  else if (a.roomKinds.includes("hallway")) out.push("Třída zátěže min. 32 (chodba).");
  if (a.diyClick) out.push("Jen click zámek pro pokládku svépomocí.");
  return out;
}

/**
 * Doporučení = filtrovací pravidla nad parametry, žádná AI.
 *  - koupelna a kuchyň → jen SPC nebo lepený vinyl
 *  - děti/zvířata → nášlap ≥ 0,4 mm a třída ≥ 32
 *  - komerční → třída ≥ 33, chodba → třída ≥ 32
 *  - podlahové topení → jen schválené; svépomoc → jen click
 *  - rozpočet → pásmo ceny za m²; pokud vyjde < 6, pásmo se uvolní (a řekneme to)
 *  - barva → měkké skóre (nikdy nevyřadí, jen řadí)
 *  Výstup: max. 9 dekorů s jednovětým důvodem.
 */
export function recommend(all: Product[], a: WizardAnswers, opts: { needM2?: number } = {}): { results: GuideResult[]; relaxed: string[]; poolSize: number } {
  const relaxed: string[] = [];
  const base = all.filter((p) => p.status === "active" && p.stockM2 > 0 && passesHardRules(p, a));

  let [min, max] = budgetRange(a.budget);
  let pool = base.filter((p) => p.pricePerM2 >= min && p.pricePerM2 < max);
  if (a.budget && pool.length < 6) {
    min = min * 0.7; max = max === Number.POSITIVE_INFINITY ? max : max * 1.3;
    const wider = base.filter((p) => p.pricePerM2 >= min && p.pricePerM2 < max);
    if (wider.length > pool.length) { pool = wider; relaxed.push("Rozpočet jsme mírně rozšířili (±30 %), aby bylo z čeho vybírat."); }
  }
  if (a.budget && pool.length < 6 && base.length > pool.length) {
    pool = base;
    relaxed.push("V přesném rozpočtu je málo dekorů — ukazujeme všechny, které splňují vaše požadavky, seřazené podle vhodnosti.");
  }

  const [bmin, bmax] = budgetRange(a.budget);
  const scored: GuideResult[] = pool.map((p) => {
    let score = 0;
    if (a.style) {
      if (p.decorTone === a.style) score += 40;
      else if ((a.style === "light-oak" && p.decorTone === "dark-wood") || (a.style === "dark-wood" && p.decorTone === "light-oak")) score += 8;
      else if ((a.style === "grey" && p.decorTone === "stone") || (a.style === "stone" && p.decorTone === "grey")) score += 15;
    }
    if (a.budget) {
      if (p.pricePerM2 >= bmin && p.pricePerM2 < bmax) score += 20;
      else score -= Math.min(15, Math.abs(p.pricePerM2 - (p.pricePerM2 < bmin ? bmin : bmax)) / 40);
    } else score += Math.max(0, 12 - p.pricePerM2 / 120); // bez rozpočtu lehce zvýhodnit levnější
    if (a.kidsPets) score += (p.wearLayerMm - 0.4) * 50 + (p.usageClass - 32) * 3;
    if (a.roomKinds.includes("bedroom") && p.type === "vinyl-hdf") score += 8;
    if (a.roomKinds.includes("living") && p.thicknessMm >= 5) score += 4;
    if ((a.roomKinds.includes("bathroom") || a.roomKinds.includes("kitchen")) && p.type === "spc") score += 6;
    if (a.floorHeating && p.type === "spc") score += 5;
    if (a.integratedUnderlay) score += p.integratedUnderlay ? 14 : -6;
    else if (p.integratedUnderlay) score += 3;
    if (opts.needM2 && p.stockM2 >= opts.needM2) score += 8;
    score += Math.min(6, p.stockM2 / 80);
    if (p.isNew) score += 1;
    return { product: p, score, reason: reasonFor(p, a) };
  });

  scored.sort((x, y) => y.score - x.score || x.product.pricePerM2 - y.product.pricePerM2);
  return { results: scored.slice(0, 9), relaxed, poolSize: pool.length };
}

const dec = (n: number) => String(n).replace(".", ",");

function reasonFor(p: Product, a: WizardAnswers): string {
  const parts: string[] = [];
  let wearMentioned = false;
  const wet = a.roomKinds.includes("bathroom") || a.roomKinds.includes("kitchen");
  if (wet) parts.push(p.type === "spc" ? "minerální SPC jádro nevadí stojící voda" : "lepený vinyl je 100 % voděodolný");
  else if (a.roomKinds.includes("commercial")) parts.push(`třída ${p.usageClass} je určená pro komerční provoz`);
  else if (a.roomKinds.includes("hallway")) { parts.push(`třída ${p.usageClass} a nášlap ${dec(p.wearLayerMm)} mm zvládnou písek i boty`); wearMentioned = true; }
  else if (a.roomKinds.includes("bedroom") && !a.roomKinds.includes("living")) parts.push(p.type === "vinyl-hdf" ? "HDF deska je teplá a tichá na došlap" : `${FLOOR_TYPE_LABEL[p.type]} s tichým došlapem`);
  // Jinak typ, tloušťku ani nášlap neopakujeme — jsou v řádku parametrů hned nad důvodem.
  if (a.floorHeating) parts.push("schváleno na podlahové topení");
  if (a.kidsPets && p.wearLayerMm >= 0.55 && !wearMentioned) parts.push("nášlap 0,55 mm odolá drápkům i hračkám");
  else if (a.kidsPets) parts.push("odolnost pro děti i zvířata");
  if (p.integratedUnderlay) parts.push("integrovaná podložka šetří peníze i čas");
  if (a.diyClick && p.lock === "click") parts.push("click zámek zvládnete položit sami");
  if (a.style && p.decorTone === a.style) parts.push(`dekor ${p.decor.toLowerCase()} přesně sedí ke zvolenému stylu`);
  const s = parts.slice(0, 3).join(", ");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) + "." : "";
}
