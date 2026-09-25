import { XMLParser } from "fast-xml-parser";
import type { FeedAdapter, FeedItem } from "../types";
import { asClass, asLock, asType, asWear, inferTone, toBool, toNumber } from "../types";
import type { AccessoryKind, AccessoryUnit, DecorTone } from "@/lib/types";

/**
 * Vinylia Distribution — strukturovaný feed <products><product sku="…"> s anglickými poli.
 * Ceny bez DPH, hmotnost balení v kg, dostupnost v m².
 */
type P = Record<string, string | undefined> & { "@_sku": string; "@_kind"?: string };

export const vinyliaAdapter: FeedAdapter = {
  id: "vinylia",
  parse(xml) {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true, parseTagValue: false });
    const doc = parser.parse(xml);
    const raw = doc?.products?.product;
    if (!raw) throw new Error("Vinylia: chybí products/product");
    const list: P[] = Array.isArray(raw) ? raw : [raw];
    return list.map((p): FeedItem => {
      if (p["@_kind"] === "accessory") {
        return {
          kind: "accessory", sku: p["@_sku"], name: p.name ?? "", accessoryKind: (p.accessory_type ?? "underlay") as AccessoryKind,
          unit: (p.unit ?? "ks") as AccessoryUnit, coverage: toNumber(p.coverage, 1), coverageLabel: p.coverage_label ?? "",
          unitWeightKg: toNumber(p.unit_kg, 0.5), purchasePrice: toNumber(p.price_net),
          decorTones: (p.tones ?? "").split(",").map((s) => s.trim()).filter(Boolean) as DecorTone[],
          floorHeating: toBool(p.underfloor_heating), stockUnits: Math.floor(toNumber(p.stock_units)),
          deliveryDays: Math.round(toNumber(p.lead_time_days, 5)), image: p.image ?? null, description: p.description ?? "",
        };
      }
      const decor = p.decor ?? p.name ?? "";
      return {
        kind: "floor", sku: p["@_sku"], name: p.name ?? "", brand: p.brand ?? "", collection: p.collection ?? "", decor,
        decorTone: p.tone ? (p.tone as DecorTone) : inferTone(decor),
        type: asType(p.core ?? ""), thicknessMm: toNumber(p.thickness_mm), wearLayerMm: asWear(toNumber(p.wear_layer_mm)),
        usageClass: asClass(Math.round(toNumber(p.usage_class))), lock: asLock(p.installation ?? ""),
        plankLengthMm: toNumber(p.plank_length_mm), plankWidthMm: toNumber(p.plank_width_mm), bevel: toBool(p.bevel),
        m2PerPack: toNumber(p.pack_m2), packWeightKg: p.pack_kg ? toNumber(p.pack_kg) : null,
        floorHeating: toBool(p.underfloor_heating), integratedUnderlay: toBool(p.integrated_underlay),
        stockM2: toNumber(p.stock_m2), deliveryDays: Math.round(toNumber(p.lead_time_days, 7)), purchasePriceM2: toNumber(p.price_net),
        imageTexture: p.image ?? "", imageRoom: p.image_room ?? null,
        imageTransform: p.image_transform ? JSON.parse(p.image_transform) : null, description: p.description ?? "",
      };
    });
  },
};
