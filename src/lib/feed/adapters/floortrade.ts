import { XMLParser } from "fast-xml-parser";
import type { FeedAdapter, FeedItem } from "../types";
import { asClass, asLock, asType, asWear, inferTone, toBool, toNumber } from "../types";
import type { AccessoryKind, AccessoryUnit, DecorTone } from "@/lib/types";

/**
 * FloorTrade CZ — feed ve stylu Heureka/Zboží: <SHOP><SHOPITEM> s volnými <PARAM> páry.
 * Parametry mají české názvy a hodnoty s jednotkami ("5 mm", "2,23 m2").
 */
type Param = { PARAM_NAME: string; VAL: string };
type ShopItem = {
  ITEM_ID: string; PRODUCTNAME: string; MANUFACTURER?: string; CATEGORYTEXT?: string; DESCRIPTION?: string;
  PRICE: string | number; STOCK?: string | number; DELIVERY_DATE?: string | number; WEIGHT?: string | number;
  IMGURL?: string; IMGURL_ALTERNATIVE?: string; PARAM?: Param | Param[]; IMG_TRANSFORM?: string;
};

function params(item: ShopItem): Record<string, string> {
  const list = item.PARAM ? (Array.isArray(item.PARAM) ? item.PARAM : [item.PARAM]) : [];
  const out: Record<string, string> = {};
  for (const p of list) out[String(p.PARAM_NAME).trim().toLowerCase()] = String(p.VAL).trim();
  return out;
}

const KIND_MAP: Record<string, AccessoryKind> = {
  "podložka": "underlay", "podlozka": "underlay", "soklová lišta": "skirting", "sokl": "skirting", "přechodová lišta": "transition",
  "lepidlo na lišty": "glue", "lepidlo na podlahu": "floor-adhesive", "silikon": "silicone", "tmel": "silicone", "čisticí sada": "cleaning",
};
const UNIT_MAP: Record<string, AccessoryUnit> = { role: "role", ks: "ks", m: "m", bal: "balení", "balení": "balení" };

export const floortradeAdapter: FeedAdapter = {
  id: "floortrade",
  parse(xml) {
    const parser = new XMLParser({ ignoreAttributes: true, trimValues: true, parseTagValue: false });
    const doc = parser.parse(xml);
    const raw = doc?.SHOP?.SHOPITEM;
    if (!raw) throw new Error("FloorTrade: chybí SHOP/SHOPITEM");
    const items: ShopItem[] = Array.isArray(raw) ? raw : [raw];
    return items.map((it): FeedItem => {
      const p = params(it);
      const category = (it.CATEGORYTEXT ?? "").toLowerCase();
      if (category.includes("příslušenství") || category.includes("prislusenstvi")) {
        const kindKey = Object.keys(KIND_MAP).find((k) => (p["druh"] ?? "").toLowerCase().includes(k)) ?? "podložka";
        return {
          kind: "accessory", sku: String(it.ITEM_ID), name: it.PRODUCTNAME,
          accessoryKind: KIND_MAP[kindKey], unit: UNIT_MAP[(p["jednotka"] ?? "ks").toLowerCase()] ?? "ks",
          coverage: toNumber(p["pokrytí"] ?? p["pokryti"], 1), coverageLabel: p["pokrytí popis"] ?? "",
          unitWeightKg: toNumber(it.WEIGHT, 0.5), purchasePrice: toNumber(it.PRICE),
          decorTones: (p["odstíny"] ?? "").split(",").map((s) => s.trim()).filter(Boolean) as DecorTone[],
          floorHeating: toBool(p["podlahové topení"]), stockUnits: Math.floor(toNumber(it.STOCK)),
          deliveryDays: Math.round(toNumber(it.DELIVERY_DATE, 5)), image: it.IMGURL ?? null, description: it.DESCRIPTION ?? "",
        };
      }
      const decor = p["dekor"] ?? it.PRODUCTNAME;
      const [len, wid] = (p["rozměr lamely"] ?? "0x0").toLowerCase().replace(/mm/g, "").split(/[x×]/).map((s) => toNumber(s));
      return {
        kind: "floor", sku: String(it.ITEM_ID), name: it.PRODUCTNAME, brand: it.MANUFACTURER ?? "", collection: p["kolekce"] ?? "",
        decor, decorTone: inferTone(decor, p["odstín"]),
        type: asType(p["typ"] ?? p["nosná deska"] ?? ""), thicknessMm: toNumber(p["tloušťka"]), wearLayerMm: asWear(toNumber(p["nášlapná vrstva"])),
        usageClass: asClass(Math.round(toNumber(p["třída zátěže"]))), lock: asLock(p["pokládka"] ?? p["zámek"] ?? ""),
        plankLengthMm: len, plankWidthMm: wid, bevel: toBool(p["fáza"]),
        m2PerPack: toNumber(p["m2 v balení"] ?? p["m² v balení"]), packWeightKg: it.WEIGHT !== undefined && it.WEIGHT !== "" ? toNumber(it.WEIGHT) : null,
        floorHeating: toBool(p["podlahové topení"]), integratedUnderlay: toBool(p["integrovaná podložka"]),
        stockM2: toNumber(it.STOCK), deliveryDays: Math.round(toNumber(it.DELIVERY_DATE, 7)), purchasePriceM2: toNumber(it.PRICE),
        imageTexture: it.IMGURL ?? "", imageRoom: it.IMGURL_ALTERNATIVE ?? null,
        imageTransform: it.IMG_TRANSFORM ? JSON.parse(it.IMG_TRANSFORM) : null, description: it.DESCRIPTION ?? "",
      };
    });
  },
};
