import type { Accessory, PricingCategory, PricingRule, Product, Settings } from "./types";

/**
 * Vyřešení marže: nejkonkrétnější pravidlo vítězí.
 *   1) dodavatel + kategorie   2) dodavatel   3) kategorie   4) globální
 * Ruční přepis na produktu (marginOverridePct) má vždy přednost.
 */
export function resolveMargin(rules: PricingRule[], supplierId: string, category: PricingCategory, override: number | null): number {
  if (override !== null && Number.isFinite(override)) return override;
  const pick = (pred: (r: PricingRule) => boolean) => rules.find(pred)?.marginPct;
  return (
    pick((r) => r.supplierId === supplierId && r.category === category) ??
    pick((r) => r.supplierId === supplierId && r.category === null) ??
    pick((r) => r.supplierId === null && r.category === category) ??
    pick((r) => r.supplierId === null && r.category === null) ??
    30
  );
}

/** Nákupní cena bez DPH → prodejní cena vč. DPH, zaokrouhlená na celé Kč. */
export function sellPrice(purchaseExVat: number, marginPct: number, vatRate: number) {
  return Math.round(purchaseExVat * (1 + marginPct / 100) * (1 + vatRate));
}

export function priceProduct(p: Product, rules: PricingRule[], settings: Settings): Product {
  const marginPct = resolveMargin(rules, p.supplierId, "floor", p.marginOverridePct);
  const pricePerM2 = sellPrice(p.purchasePriceM2, marginPct, settings.vatRate);
  // Cena za balení se odvozuje z již zaokrouhlené ceny za m², aby si čísla na kartě vzájemně odpovídala.
  const pricePerPack = Math.round(pricePerM2 * p.m2PerPack);
  return { ...p, marginPct, pricePerM2, pricePerPack };
}

export function priceAccessory(a: Accessory, rules: PricingRule[], settings: Settings): Accessory {
  const marginPct = resolveMargin(rules, a.supplierId, "accessory", a.marginOverridePct);
  return { ...a, marginPct, pricePerUnit: sellPrice(a.purchasePrice, marginPct, settings.vatRate) };
}

/** Bezpečnostní rezerva dostupnosti: z 40 m² u dodavatele prodáváme max 36 m². */
export function safeStock(rawM2: number, safetyPct: number) {
  return Math.max(0, Math.floor(rawM2 * (1 - safetyPct / 100) * 100) / 100);
}

export function estimatePackWeight(p: Pick<Product, "type" | "m2PerPack">, settings: Settings) {
  return Math.round(settings.weightEstimateKgPerM2[p.type] * p.m2PerPack * 10) / 10;
}
