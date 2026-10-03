import { FLOOR_TYPE_LABEL, type DecorTone, type FloorType, type LockType, type UsageClass, type WearLayer } from "./types";
import type { PublicProduct as Product } from "./public";

export interface CatalogFilters {
  type: FloorType[];
  lock: LockType[];
  thickness: number[];
  wear: WearLayer[];
  usage: UsageClass[];
  tone: DecorTone[];
  priceMin: number | null;
  priceMax: number | null;
  floorHeating: boolean | null;
  integratedUnderlay: boolean | null;
  waterproof: boolean | null;
  /** Minimální dostupnost v m². */
  minStock: number | null;
  q: string;
  sort: "price-asc" | "price-desc" | "stock" | "new";
}

export const EMPTY_FILTERS: CatalogFilters = {
  type: [], lock: [], thickness: [], wear: [], usage: [], tone: [],
  priceMin: null, priceMax: null, floorHeating: null, integratedUnderlay: null, waterproof: null, minStock: null, q: "", sort: "price-asc",
};

export type SearchParams = Record<string, string | string[] | undefined>;

const arr = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : v.split(","));
const nums = (v: string | string[] | undefined) => arr(v).map(Number).filter((n) => Number.isFinite(n));
const bool = (v: string | string[] | undefined) => (v === "1" || v === "true" ? true : v === "0" || v === "false" ? false : null);
const num = (v: string | string[] | undefined) => { const n = Number(Array.isArray(v) ? v[0] : v); return Number.isFinite(n) && (Array.isArray(v) ? v[0] : v) !== undefined && (Array.isArray(v) ? v[0] : v) !== "" ? n : null; };

export function parseFilters(sp: SearchParams, preset: Partial<CatalogFilters> = {}): CatalogFilters {
  const f: CatalogFilters = {
    ...EMPTY_FILTERS,
    type: arr(sp.type) as FloorType[],
    lock: arr(sp.lock) as LockType[],
    thickness: nums(sp.thickness),
    wear: nums(sp.wear) as WearLayer[],
    usage: nums(sp.usage) as UsageClass[],
    tone: arr(sp.tone) as DecorTone[],
    priceMin: num(sp.priceMin),
    priceMax: num(sp.priceMax),
    floorHeating: bool(sp.heating),
    integratedUnderlay: bool(sp.underlay),
    waterproof: bool(sp.waterproof),
    minStock: num(sp.minStock),
    q: typeof sp.q === "string" ? sp.q : "",
    sort: (["price-asc", "price-desc", "stock", "new"].includes(String(sp.sort)) ? String(sp.sort) : "price-asc") as CatalogFilters["sort"],
  };
  // Preset landing page: přednastavené hodnoty mají přednost (pevná část URL).
  for (const [k, v] of Object.entries(preset)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) { if (v.length) (f as unknown as Record<string, unknown>)[k] = v; }
    else (f as unknown as Record<string, unknown>)[k] = v;
  }
  return f;
}

/** Hledání bez ohledu na diakritiku a velikost písmen („sedy“ najde „Šedý“). */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function applyFilters(list: Product[], f: CatalogFilters): Product[] {
  // Slova hledání v libovolném pořadí — musí sedět všechna („šedý dub“ = „Dub Šedý“).
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  let out = list.filter((p) => {
    if (f.type.length && !f.type.includes(p.type)) return false;
    if (f.lock.length && !f.lock.includes(p.lock)) return false;
    if (f.thickness.length && !f.thickness.includes(p.thicknessMm)) return false;
    if (f.wear.length && !f.wear.includes(p.wearLayerMm)) return false;
    if (f.usage.length && !f.usage.includes(p.usageClass)) return false;
    if (f.tone.length && !f.tone.includes(p.decorTone)) return false;
    if (f.priceMin !== null && p.pricePerM2 < f.priceMin) return false;
    if (f.priceMax !== null && p.pricePerM2 > f.priceMax) return false;
    if (f.floorHeating !== null && p.floorHeating !== f.floorHeating) return false;
    if (f.integratedUnderlay !== null && p.integratedUnderlay !== f.integratedUnderlay) return false;
    if (f.waterproof !== null && p.waterproof !== f.waterproof) return false;
    if (f.minStock !== null && p.stockM2 < f.minStock) return false;
    if (words.length) {
      const hay = norm(`${p.name} ${p.brand} ${p.collection} ${p.decor} ${FLOOR_TYPE_LABEL[p.type]}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  switch (f.sort) {
    case "price-asc": out = out.sort((a, b) => a.pricePerM2 - b.pricePerM2); break;
    case "price-desc": out = out.sort((a, b) => b.pricePerM2 - a.pricePerM2); break;
    case "stock": out = out.sort((a, b) => b.stockM2 - a.stockM2 || a.deliveryDays - b.deliveryDays); break;
    case "new": out = out.sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.createdAt.localeCompare(a.createdAt)); break;
  }
  return out;
}

export function filtersToQuery(f: Partial<CatalogFilters>): string {
  const p = new URLSearchParams();
  if (f.type?.length) p.set("type", f.type.join(","));
  if (f.lock?.length) p.set("lock", f.lock.join(","));
  if (f.thickness?.length) p.set("thickness", f.thickness.join(","));
  if (f.wear?.length) p.set("wear", f.wear.join(","));
  if (f.usage?.length) p.set("usage", f.usage.join(","));
  if (f.tone?.length) p.set("tone", f.tone.join(","));
  if (f.priceMin != null) p.set("priceMin", String(f.priceMin));
  if (f.priceMax != null) p.set("priceMax", String(f.priceMax));
  if (f.floorHeating != null) p.set("heating", f.floorHeating ? "1" : "0");
  if (f.integratedUnderlay != null) p.set("underlay", f.integratedUnderlay ? "1" : "0");
  if (f.waterproof != null) p.set("waterproof", f.waterproof ? "1" : "0");
  if (f.minStock != null) p.set("minStock", String(f.minStock));
  if (f.q) p.set("q", f.q);
  if (f.sort && f.sort !== "price-asc") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** SEO landing pages: pevná část filtru je součástí URL a má vlastní H1 + text. */
export interface LandingDef {
  slug: string;
  preset: Partial<CatalogFilters>;
  /** Které filtry jsou landing page „zamčené“ (v UI se nezobrazují jako změnitelné). */
  locked: (keyof CatalogFilters)[];
  navLabel: string;
  /** Nadpis sbaleného SEO textu pod výpisem („Proč …“). */
  seoTitle: string;
}

export const LANDINGS: LandingDef[] = [
  { slug: "spc-vinylove-podlahy", preset: { type: ["spc"] }, locked: ["type"], navLabel: "SPC podlahy", seoTitle: "Proč SPC podlaha" },
  { slug: "vinylove-podlahy-click", preset: { lock: ["click"] }, locked: ["lock"], navLabel: "Click vinyl", seoTitle: "Proč click vinyl" },
  { slug: "vinyl-do-koupelny", preset: { waterproof: true }, locked: ["waterproof"], navLabel: "Do koupelny", seoTitle: "Jaký vinyl do koupelny" },
  { slug: "vinyl-na-podlahove-topeni", preset: { floorHeating: true }, locked: ["floorHeating"], navLabel: "Na podlahové topení", seoTitle: "Vinyl a podlahové topení" },
  // Všechny duby včetně šedých; odstín si zákazník zúží filtrem.
  { slug: "vinylove-podlahy-dub", preset: { q: "dub" }, locked: ["q"], navLabel: "Dekor dub", seoTitle: "Proč dubový dekor" },
];

export function landingBySlug(slug: string) {
  return LANDINGS.find((l) => l.slug === slug) ?? null;
}

export const PRICE_BANDS = [
  { label: "do 400 Kč/m²", min: null, max: 400 },
  { label: "400–700 Kč/m²", min: 400, max: 700 },
  { label: "700–1 000 Kč/m²", min: 700, max: 1000 },
  { label: "nad 1 000 Kč/m²", min: 1000, max: null },
];
