import type { Accessory, Product, Settings } from "./types";

/**
 * Veřejná podoba produktu — bez nákupních cen, marží, SKU dodavatele a zdrojů obrázků.
 * Jen tato podoba smí odejít do klientských komponent / API odpovědí.
 */
export type PublicProduct = Omit<Product, "purchasePriceM2" | "marginPct" | "marginOverridePct" | "supplierSku" | "stockM2Raw" | "images"> & {
  images: Omit<Product["images"], "sources">;
};

export type PublicAccessory = Omit<Accessory, "purchasePrice" | "marginPct" | "marginOverridePct" | "supplierSku">;

export function toPublicProduct(p: Product): PublicProduct {
  const { purchasePriceM2: _a, marginPct: _b, marginOverridePct: _c, supplierSku: _d, stockM2Raw: _e, images, ...rest } = p;
  const { sources: _s, ...img } = images;
  return { ...rest, images: img };
}

export function toPublicAccessory(a: Accessory): PublicAccessory {
  const { purchasePrice: _a, marginPct: _b, marginOverridePct: _c, supplierSku: _d, ...rest } = a;
  return rest;
}

/** Nastavení potřebné v klientu (bez interních pojistek pipeline). */
export type PublicSettings = Pick<Settings, "vatRate" | "freeShippingFromM2" | "shipping" | "samples" | "weightEstimateKgPerM2">;
export function toPublicSettings(s: Settings): PublicSettings {
  return { vatRate: s.vatRate, freeShippingFromM2: s.freeShippingFromM2, shipping: s.shipping, samples: s.samples, weightEstimateKgPerM2: s.weightEstimateKgPerM2 };
}
