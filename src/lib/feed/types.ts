import type { AccessoryKind, AccessoryUnit, DecorTone, FloorType, LockType, UsageClass, WearLayer } from "@/lib/types";

/** Normalizovaná položka podlahy tak, jak ji vrací adaptér dodavatele. */
export interface FeedFloorItem {
  kind: "floor";
  sku: string;
  name: string;
  brand: string;
  collection: string;
  decor: string;
  /** Odstín, pokud ho dodavatel posílá; jinak se odvodí z názvu dekoru. */
  decorTone: DecorTone | null;
  type: FloorType;
  thicknessMm: number;
  wearLayerMm: WearLayer;
  usageClass: UsageClass;
  lock: LockType;
  plankLengthMm: number;
  plankWidthMm: number;
  bevel: boolean;
  m2PerPack: number;
  /** null = dodavatel hmotnost neposlal → odhad + upozornění */
  packWeightKg: number | null;
  floorHeating: boolean;
  integratedUnderlay: boolean;
  stockM2: number;
  deliveryDays: number;
  purchasePriceM2: number;
  imageTexture: string;
  imageRoom: string | null;
  /** Volitelný ladicí transform pro demo dataset (u reálných feedů prázdné). */
  imageTransform: { brightness?: number; saturation?: number; hue?: number; crop?: "center" | "top" | "bottom" } | null;
  description: string;
}

export interface FeedAccessoryItem {
  kind: "accessory";
  sku: string;
  name: string;
  accessoryKind: AccessoryKind;
  unit: AccessoryUnit;
  coverage: number;
  coverageLabel: string;
  unitWeightKg: number;
  purchasePrice: number;
  decorTones: DecorTone[];
  floorHeating: boolean;
  stockUnits: number;
  deliveryDays: number;
  image: string | null;
  description: string;
}

export type FeedItem = FeedFloorItem | FeedAccessoryItem;

export interface FeedAdapter {
  id: string;
  /** Převede XML dodavatele na normalizované položky. Vyhazuje výjimku při nevalidním feedu. */
  parse(xml: string): FeedItem[];
}

export function inferTone(decor: string, hint?: string | null): DecorTone {
  const s = `${decor} ${hint ?? ""}`.toLowerCase();
  if (/(beton|kámen|kamen|mramor|travertin|břidlice|bridlice|terrazzo|stone|concrete|slate|marble)/.test(s)) return "stone";
  if (/(šed|sed[aáy]|grey|gray|popel|stříbr|stribr|grafit|antracit)/.test(s)) return "grey";
  if (/(tmav|kouř|kour|ořech|orech|wenge|uhl|káv|kav|karamel|antik|dark|walnut|smoke)/.test(s)) return "dark-wood";
  return "light-oak";
}

export function isWaterproof(type: FloorType) {
  return type !== "vinyl-hdf";
}

export function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return ["1", "true", "ano", "yes", "y", "a"].includes(s);
}

export function asWear(v: number): WearLayer {
  if (v >= 0.5) return 0.55;
  if (v >= 0.35) return 0.4;
  return 0.3;
}

export function asClass(v: number): UsageClass {
  const allowed: UsageClass[] = [23, 31, 32, 33, 42];
  return allowed.includes(v as UsageClass) ? (v as UsageClass) : v >= 42 ? 42 : v >= 33 ? 33 : v >= 32 ? 32 : v >= 31 ? 31 : 23;
}

export function asType(v: string): FloorType {
  const s = v.toLowerCase();
  if (s.includes("spc") || s.includes("rigid") || s.includes("mineral")) return "spc";
  if (s.includes("hdf")) return "vinyl-hdf";
  if (s.includes("kompozit") || s.includes("composite") || s.includes("wpc")) return "vinyl-composite";
  return "vinyl-glue";
}

export function asLock(v: string): LockType {
  const s = v.toLowerCase();
  if (s.includes("click") || s.includes("zámek") || s.includes("zamek") || s.includes("plovouc")) return "click";
  if (s.includes("samolep") || s.includes("self") || s.includes("adhesive") || s.includes("stick")) return "self-adhesive";
  return "glue";
}
