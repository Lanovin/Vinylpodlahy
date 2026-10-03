import type { Accessory, CartItem, CartQuote, CartQuoteLine, Product, Settings, Shipment, Supplier } from "./types";
import type { PublicProduct, PublicSettings } from "./public";
import { FLOOR_TYPE_LABEL } from "./types";

const r1 = (v: number) => Math.round(v * 10) / 10;

export interface ShippingContext {
  products: Product[];
  accessories: Accessory[];
  suppliers: Supplier[];
  settings: Settings;
}

export interface CarryUpChoice { enabled: boolean; floor: number; elevator: boolean }

/** Cena dopravy jedné zásilky podle hmotnosti. */
export function shippingForWeight(weightKg: number, settings: PublicSettings) {
  const s = settings.shipping;
  if (weightKg <= 0) return { method: "parcel" as const, methodLabel: "Balík", price: 0 };
  if (weightKg > s.palletThresholdKg) {
    const tier = s.palletTiers.find((t) => weightKg <= t.maxKg) ?? s.palletTiers[s.palletTiers.length - 1];
    return { method: "pallet" as const, methodLabel: tier.label, price: tier.price };
  }
  const parcels = Math.max(1, Math.ceil(weightKg / s.parcelMaxKg));
  return {
    method: "parcel" as const,
    methodLabel: parcels === 1 ? "Balík" : `${parcels} balíky`,
    price: s.parcelPrice + (parcels - 1) * s.parcelAdditionalPrice,
  };
}

export function carryUpPrice(method: "parcel" | "pallet", choice: CarryUpChoice, settings: PublicSettings) {
  if (!choice.enabled) return 0;
  if (method === "parcel") return settings.shipping.carryUpParcelPrice;
  const floors = choice.elevator ? 1 : Math.max(1, choice.floor);
  return settings.shipping.carryUpPalletPricePerFloor * floors;
}

/** Odhad dopravy pro kartu produktu: N balení jednoho produktu. */
export function estimateProductShipping(product: PublicProduct, packs: number, settings: PublicSettings) {
  const weight = r1(packs * product.packWeightKg);
  const m2 = packs * product.m2PerPack;
  const base = shippingForWeight(weight, settings);
  const free = m2 >= settings.freeShippingFromM2;
  return { weightKg: weight, m2, ...base, free, price: free ? 0 : base.price, estimated: product.weightEstimated };
}

export function deliveryLabel(daysMax: number) {
  if (daysMax <= 0) return "termín upřesníme";
  const lo = Math.max(1, daysMax - 2);
  return `${lo}–${daysMax} pracovních dní`;
}

/** Podíl jedné položky na zásilce (hmotnost, m² podlahy, lhůta) — vstup pro `planShipments`. */
export interface ShipmentPart { supplierId: string; weightKg: number; floorM2: number; weightEstimated: boolean; deliveryDays: number }

export interface PlannedShipment {
  supplierId: string;
  weightKg: number;
  weightEstimated: boolean;
  floorM2: number;
  deliveryDays: number;
  method: "parcel" | "pallet";
  methodLabel: string;
  basePrice: number;
  freeShipping: boolean;
  price: number;
}

/**
 * Rozdělení zboží na zásilky podle dodavatele a cena dopravy každé z nich (bez vynášky).
 * Čistá funkce bez dat dodavatelů — používá ji košík (`quoteCart`) i kalkulačka, aby se ceny nikdy nerozešly.
 * Zdarma je zásilka, která obsahuje aspoň `freeShippingFromM2` m² podlahy; samotné příslušenství se platí vždy.
 */
export function planShipments(parts: ShipmentPart[], settings: PublicSettings): PlannedShipment[] {
  const by = new Map<string, { weight: number; floorM2: number; estimated: boolean; days: number }>();
  for (const p of parts) {
    const cur = by.get(p.supplierId) ?? { weight: 0, floorM2: 0, estimated: false, days: 0 };
    cur.weight += p.weightKg; cur.floorM2 += p.floorM2; cur.estimated ||= p.weightEstimated; cur.days = Math.max(cur.days, p.deliveryDays);
    by.set(p.supplierId, cur);
  }
  return [...by].map(([supplierId, x]) => {
    const weight = r1(x.weight);
    const base = shippingForWeight(weight, settings);
    const free = x.floorM2 >= settings.freeShippingFromM2;
    return {
      supplierId, weightKg: weight, weightEstimated: x.estimated, floorM2: Math.round(x.floorM2 * 100) / 100, deliveryDays: x.days,
      method: base.method, methodLabel: base.methodLabel, basePrice: base.price, freeShipping: free, price: free ? 0 : base.price,
    };
  });
}

/** Kompletní ocenění košíku: řádky, rozdělení na zásilky podle dodavatele, doprava, vynáška. */
export function quoteCart(items: CartItem[], carryUp: CarryUpChoice, ctx: ShippingContext): CartQuote {
  const { settings } = ctx;
  const warnings: string[] = [];
  const lines: CartQuoteLine[] = [];

  for (const it of items) {
    if (it.qty <= 0) continue;
    if (it.kind === "product") {
      const p = ctx.products.find((x) => x.id === it.id);
      if (!p) { warnings.push("Jedna položka košíku už není v nabídce a byla odebrána."); continue; }
      const m2 = it.qty * p.m2PerPack;
      const available = p.status === "active" && m2 <= p.stockM2;
      lines.push({
        kind: "product", id: p.id, slug: p.slug, name: p.name,
        detail: `${FLOOR_TYPE_LABEL[p.type]} · ${p.m2PerPack.toFixed(2).replace(".", ",")} m²/bal · ${p.pricePerM2} Kč/m²`,
        image: p.images.card, qty: it.qty, unit: "balení", unitPrice: p.pricePerPack, lineTotal: it.qty * p.pricePerPack,
        supplierId: p.supplierId, available, m2,
        availabilityNote: p.status !== "active"
          ? "Produkt je dočasně pozastaven (změna ceny u dodavatele). Ozveme se s aktuální nabídkou."
          : m2 > p.stockM2 ? `Dostupných je ${p.stockM2.toFixed(2).replace(".", ",")} m², zbytek doobjednáme s delší lhůtou.` : null,
      });
    } else {
      const a = ctx.accessories.find((x) => x.id === it.id);
      if (!a) { warnings.push("Jedna položka příslušenství už není v nabídce a byla odebrána."); continue; }
      lines.push({
        kind: "accessory", id: a.id, slug: a.slug, name: a.name, detail: a.coverageLabel, image: a.image,
        qty: it.qty, unit: a.unit, unitPrice: a.pricePerUnit, lineTotal: it.qty * a.pricePerUnit,
        supplierId: a.supplierId, available: a.status === "active" && it.qty <= a.stockUnits, m2: null,
        availabilityNote: it.qty > a.stockUnits ? `Skladem ${a.stockUnits} ${a.unit}, zbytek doobjednáme.` : null,
      });
    }
  }

  // Rozdělení na zásilky podle dodavatele — každá má vlastní hmotnost, cenu dopravy i termín.
  // Výpočet zásilek sdílí s kalkulačkou `planShipments` (cena „celý projekt“ v kalkulačce = košík).
  const planned = planShipments(lines.map((l) => {
    if (l.kind === "product") {
      const p = ctx.products.find((x) => x.id === l.id)!;
      return { supplierId: l.supplierId, weightKg: l.qty * p.packWeightKg, floorM2: l.qty * p.m2PerPack, weightEstimated: p.weightEstimated, deliveryDays: p.deliveryDays };
    }
    const a = ctx.accessories.find((x) => x.id === l.id)!;
    return { supplierId: l.supplierId, weightKg: l.qty * a.unitWeightKg, floorM2: 0, weightEstimated: false, deliveryDays: a.deliveryDays };
  }), settings);

  const shipments: Shipment[] = planned.map((ps) => {
    const sl = lines.filter((l) => l.supplierId === ps.supplierId);
    const sup = ctx.suppliers.find((s) => s.id === ps.supplierId);
    const notes: string[] = [];
    if (ps.method === "pallet") notes.push("Paletová přeprava: řidič složí paletu ke krajnici / před dům. Vynáška do patra je příplatek.");
    else notes.push("Balíková přeprava ke dveřím domu.");
    if (ps.freeShipping) notes.push(`Doprava zdarma — zásilka obsahuje ${ps.floorM2.toFixed(2).replace(".", ",")} m² podlahy (limit ${settings.freeShippingFromM2} m²).`);
    if (ps.weightEstimated) notes.push("Hmotnost části zboží je odhadnuta.");
    return {
      supplierId: ps.supplierId, supplierName: sup?.name ?? "Dodavatel", shipsFrom: sup?.shipsFrom ?? "",
      items: sl.map((l) => ({ kind: l.kind, id: l.id, name: l.name, qty: l.qty })),
      weightKg: ps.weightKg, weightEstimated: ps.weightEstimated, floorM2: ps.floorM2,
      method: ps.method, methodLabel: ps.methodLabel, basePrice: ps.basePrice, freeShipping: ps.freeShipping,
      price: ps.price,
      // Vynáška se účtuje jen u zásilek s podlahou / paletou — drobné příslušenství jde ke dveřím tak jako tak.
      carryUpPrice: ps.method === "pallet" || ps.floorM2 > 0 ? carryUpPrice(ps.method, carryUp, settings) : 0,
      deliveryDays: ps.deliveryDays, deliveryLabel: deliveryLabel(ps.deliveryDays), notes,
    };
  });
  if (shipments.length > 1) warnings.push(`Objednávka obsahuje zboží od ${shipments.length} dodavatelů — přijde ve ${shipments.length} zásilkách, každá s vlastním termínem.`);

  const itemsTotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const shippingTotal = shipments.reduce((s, x) => s + x.price, 0);
  const carryUpTotal = shipments.reduce((s, x) => s + x.carryUpPrice, 0);
  return {
    lines, shipments, itemsTotal, shippingTotal, carryUpTotal,
    total: itemsTotal + shippingTotal + carryUpTotal,
    totalFloorM2: Math.round(lines.reduce((s, l) => s + (l.m2 ?? 0), 0) * 100) / 100,
    totalWeightKg: r1(shipments.reduce((s, x) => s + x.weightKg, 0)),
    warnings,
  };
}
