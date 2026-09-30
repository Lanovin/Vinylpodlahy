import { EMPTY_FILTERS, filtersToQuery, PRICE_BANDS, type CatalogFilters } from "@/lib/catalog";
import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LOCK_LABEL } from "@/lib/types";

type Locked = (keyof CatalogFilters)[];

/** URL výpisu bez zamčených klíčů landing page — ty jsou dané adresou stránky. */
export function catalogHref(pathname: string, f: Partial<CatalogFilters>, locked: Locked) {
  const cleaned = { ...f };
  for (const k of locked) delete cleaned[k];
  return `${pathname}${filtersToQuery(cleaned)}`;
}

/** Filtry z panelu vynulované; hledání a řazení zůstávají. */
export function clearedFilters(f: CatalogFilters): CatalogFilters {
  return { ...EMPTY_FILTERS, q: f.q, sort: f.sort };
}

export interface ActiveChip { key: string; label: string; next: CatalogFilters }

const mm = (n: number) => `${String(n).replace(".", ",")} mm`;

/**
 * Aktivní (uživatelem zvolené) filtry jako štítky s „×“. Zamčené klíče landing page se nepočítají.
 * Počet filtrů pro tlačítko „Filtry (n)“ = štítky bez hledání.
 */
export function activeChips(f: CatalogFilters, locked: Locked): ActiveChip[] {
  const out: ActiveChip[] = [];
  const on = (k: keyof CatalogFilters) => !locked.includes(k);
  const each = <T,>(k: "type" | "lock" | "thickness" | "wear" | "usage" | "tone", vals: T[], label: (v: T) => string) => {
    if (!on(k)) return;
    for (const v of vals) out.push({ key: `${k}:${v}`, label: label(v), next: { ...f, [k]: vals.filter((x) => x !== v) } as CatalogFilters });
  };
  const flag = (k: "floorHeating" | "integratedUnderlay" | "waterproof", yes: string, no: string) => {
    const v = f[k];
    if (on(k) && v !== null) out.push({ key: k, label: v ? yes : no, next: { ...f, [k]: null } });
  };

  if (f.q && on("q")) out.push({ key: "q", label: `„${f.q}“`, next: { ...f, q: "" } });
  each("type", f.type, (v) => FLOOR_TYPE_LABEL[v]);
  each("tone", f.tone, (v) => DECOR_TONE_LABEL[v]);
  if (f.priceMin !== null || f.priceMax !== null) {
    const band = PRICE_BANDS.find((b) => b.min === f.priceMin && b.max === f.priceMax);
    out.push({ key: "price", label: band?.label ?? `${f.priceMin ?? 0}–${f.priceMax ?? "∞"} Kč/m²`, next: { ...f, priceMin: null, priceMax: null } });
  }
  flag("waterproof", "Do koupelny", "Ne do koupelny");
  flag("floorHeating", "Na podlahové topení", "Bez podlahového topení");
  each("lock", f.lock, (v) => LOCK_LABEL[v]);
  each("thickness", f.thickness, mm);
  each("wear", f.wear, (v) => `nášlap ${mm(v)}`);
  each("usage", f.usage, (v) => `tř. ${v}`);
  flag("integratedUnderlay", "S podložkou", "Bez podložky");
  if (f.minStock !== null && on("minStock")) out.push({ key: "minStock", label: `Aspoň ${f.minStock} m² skladem`, next: { ...f, minStock: null } });
  return out;
}
