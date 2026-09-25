import { XMLParser } from "fast-xml-parser";
import type { FeedAdapter, FeedItem } from "../types";
import { asClass, asLock, asType, asWear, inferTone, toBool, toNumber } from "../types";
import type { AccessoryKind, AccessoryUnit, DecorTone } from "@/lib/types";

/**
 * Nordic Floors — feed s atributy: <catalog><item id type><title/><attrs …/><price net/><stock unit qty/><images><img/></images></item>.
 * Některé položky NEMAJÍ hmotnost → pipeline ji odhadne a založí upozornění.
 */
type Item = {
  "@_id": string; "@_type": "floor" | "accessory"; title: string; brand?: string; series?: string; decor?: string; description?: string;
  attrs?: Record<string, string>; price?: { "@_net": string }; stock?: { "@_unit": string; "@_qty": string; "@_lead": string };
  images?: { img: string | string[]; "@_transform"?: string };
};

export const nordicAdapter: FeedAdapter = {
  id: "nordic",
  parse(xml) {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", trimValues: true, parseTagValue: false });
    const doc = parser.parse(xml);
    const raw = doc?.catalog?.item;
    if (!raw) throw new Error("Nordic: chybí catalog/item");
    const list: Item[] = Array.isArray(raw) ? raw : [raw];
    return list.map((it): FeedItem => {
      const a = it.attrs ?? {};
      const imgs = it.images?.img ? (Array.isArray(it.images.img) ? it.images.img : [it.images.img]) : [];
      if (it["@_type"] === "accessory") {
        return {
          kind: "accessory", sku: it["@_id"], name: it.title, accessoryKind: (a["@_kind"] ?? "cleaning") as AccessoryKind,
          unit: (a["@_unit"] ?? "ks") as AccessoryUnit, coverage: toNumber(a["@_coverage"], 1), coverageLabel: a["@_coverage_label"] ?? "",
          unitWeightKg: toNumber(a["@_kg"], 0.5), purchasePrice: toNumber(it.price?.["@_net"]),
          decorTones: (a["@_tones"] ?? "").split(",").map((s) => s.trim()).filter(Boolean) as DecorTone[],
          floorHeating: toBool(a["@_ufh"]), stockUnits: Math.floor(toNumber(it.stock?.["@_qty"])),
          deliveryDays: Math.round(toNumber(it.stock?.["@_lead"], 5)), image: imgs[0] ?? null, description: it.description ?? "",
        };
      }
      const decor = it.decor ?? it.title;
      return {
        kind: "floor", sku: it["@_id"], name: it.title, brand: it.brand ?? "", collection: it.series ?? "", decor,
        decorTone: inferTone(decor, a["@_tone"]),
        type: asType(a["@_core"] ?? ""), thicknessMm: toNumber(a["@_thickness"]), wearLayerMm: asWear(toNumber(a["@_wear"])),
        usageClass: asClass(Math.round(toNumber(a["@_class"]))), lock: asLock(a["@_install"] ?? ""),
        plankLengthMm: toNumber(a["@_length"]), plankWidthMm: toNumber(a["@_width"]), bevel: toBool(a["@_bevel"]),
        m2PerPack: toNumber(a["@_pack_m2"]), packWeightKg: a["@_pack_kg"] ? toNumber(a["@_pack_kg"]) : null,
        floorHeating: toBool(a["@_ufh"]), integratedUnderlay: toBool(a["@_underlay"]),
        stockM2: toNumber(it.stock?.["@_qty"]), deliveryDays: Math.round(toNumber(it.stock?.["@_lead"], 7)), purchasePriceM2: toNumber(it.price?.["@_net"]),
        imageTexture: imgs[0] ?? "", imageRoom: imgs[1] ?? null,
        imageTransform: it.images?.["@_transform"] ? JSON.parse(it.images["@_transform"]) : null, description: it.description ?? "",
      };
    });
  },
};
