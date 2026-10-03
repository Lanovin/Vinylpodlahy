import type { Accessory, CartItem, CartQuote, Product } from "./types";

/** Strop množství jedné položky a počtu řádků košíku (ochrana proti nesmyslným / zneužitým požadavkům). */
export const MAX_QTY_PER_LINE = 999;
export const MAX_CART_LINES = 60;

/** Sloučí duplicitní řádky (stejný druh + id), zahodí nulové a omezí množství i počet řádků. */
export function normalizeItems(items: CartItem[]): CartItem[] {
  const out: CartItem[] = [];
  for (const it of items) {
    if (!(it.qty > 0)) continue;
    const ex = out.find((x) => x.kind === it.kind && x.id === it.id);
    if (ex) ex.qty = Math.min(MAX_QTY_PER_LINE, ex.qty + it.qty);
    else out.push({ kind: it.kind, id: it.id, qty: Math.min(MAX_QTY_PER_LINE, Math.floor(it.qty)) });
  }
  return out.slice(0, MAX_CART_LINES);
}

/** Telefon: aspoň 9 a nejvýš 15 číslic (mezery, pomlčky, závorky a +420 jsou v pořádku). */
export function phoneOk(phone: string) {
  if (!/^[\d\s()+\-/.]+$/.test(phone.trim())) return false;
  const digits = phone.replace(/\D/g, "").length;
  return digits >= 9 && digits <= 15;
}

/**
 * Označí řádky, které nejde objednat: produkt nebo příslušenství je pozastavené / skryté.
 * `available:false` kvůli nedostatku skladu (jen delší lhůta) se NEblokuje.
 */
export function markBlocked(quote: CartQuote, products: Product[], accessories: Accessory[]): CartQuote {
  const lines = quote.lines.map((l) => {
    if (l.kind === "product") {
      const p = products.find((x) => x.id === l.id);
      if (!p || p.status === "active") return { ...l, blocked: false };
      return {
        ...l,
        blocked: true,
        availabilityNote: p.status === "paused"
          ? "Dekor je dočasně pozastavený (čekáme na novou cenu od dodavatele) — teď ho nejde objednat. Odeberte ho, nebo vyberte podobný."
          : "Dekor už není v nabídce — nejde objednat. Odeberte ho, nebo vyberte podobný.",
        alternativesHref: p.status === "paused" ? `/podlaha/${p.slug}` : `/podlahy?tone=${p.decorTone}`,
      };
    }
    const a = accessories.find((x) => x.id === l.id);
    if (!a || a.status === "active") return { ...l, blocked: false };
    return { ...l, blocked: true, availabilityNote: "Položka je dočasně nedostupná — teď ji nejde objednat. Odeberte ji, nebo vyberte jinou.", alternativesHref: "/prislusenstvi" };
  });
  return { ...quote, lines };
}

export const hasBlocked = (q: CartQuote) => q.lines.some((l) => l.blocked);

/** Návrh doplnění příslušenství k podlaze v košíku (API /api/cart/suggest). */
export interface AccessorySuggestion {
  productId: string;
  productName: string;
  m2: number;
  items: { id: string; kind: "underlay" | "skirting"; name: string; qty: number; unit: string; lineTotal: number }[];
  total: number;
}
