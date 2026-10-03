import type { DecorTone, FloorType, LockType, PricingRule, Supplier, UsageClass, WearLayer, AccessoryKind, AccessoryUnit } from "@/lib/types";
import type { AccessoryVisual, DecorLook } from "./decor-render";

/**
 * Demo dataset. Reálné feedy nejsou k dispozici, proto generujeme tři mock XML feedy
 * (každý v jiném formátu) z těchto definic. Sync pipeline je pak zpracuje úplně stejně,
 * jako by přišly od skutečných dodavatelů.
 */
const F = (name: string) => `file://fotky_podlahy/${name}`;

export const PHOTOS = {
  roomWarm: F("pexels-curtis-adams-1694007-3935327.jpg"),
  roomMinimal: F("pexels-designecologist-15226296.jpg"),
  texOakMid: F("pexels-digitalbuggu-314073.jpg"),
  texOakLight: F("pexels-digitalbuggu-368755.jpg"),
  texOakHoney: F("pexels-hakimsatoso-5776224.jpg"),
  roomDark: F("pexels-irfansimsar-36252681.jpg"),
  roomCorridor: F("pexels-kayo-akahori-1164389329-35571117.jpg"),
  texHerringbone: F("pexels-leticia-alvares-1805702-36178801.jpg"),
  roomConcrete: F("pexels-meruyert-gonullu-7314609.jpg"),
  texTile: F("pexels-rebornfilmes-29222397.jpg"),
  roomMarble: F("pexels-thesovereignwolf-13369847.jpg"),
  roomSlate: F("pexels-thuan-33701233.jpg"),
  texDark: F("pexels-tiago-silveira-2248531-5476279.jpg"),
  roomLightHall: F("pexels-yi-ren-57040649-26068814.jpg"),
};

export const SUPPLIERS: Supplier[] = [
  { id: "floortrade", name: "FloorTrade CZ s.r.o.", feedUrl: "file://data/feeds/incoming/floortrade.xml", adapter: "floortrade", shipsFrom: "Brno", lastSyncAt: null, lastSyncStatus: "never", active: true },
  { id: "vinylia", name: "Vinylia Distribution a.s.", feedUrl: "file://data/feeds/incoming/vinylia.xml", adapter: "vinylia", shipsFrom: "Praha", lastSyncAt: null, lastSyncStatus: "never", active: true },
  { id: "nordic", name: "Nordic Floors s.r.o.", feedUrl: "file://data/feeds/incoming/nordic.xml", adapter: "nordic", shipsFrom: "Ostrava", lastSyncAt: null, lastSyncStatus: "never", active: true },
];

export const PRICING_RULES: PricingRule[] = [
  { id: "pr_global_floor", supplierId: null, category: "floor", marginPct: 30, note: "Výchozí marže na podlahy" },
  { id: "pr_global_acc", supplierId: null, category: "accessory", marginPct: 45, note: "Výchozí marže na příslušenství (vyšší než podlaha)" },
  { id: "pr_vinylia_floor", supplierId: "vinylia", category: "floor", marginPct: 27, note: "Vinylia má vyšší ceníkové ceny, držíme konkurenceschopnost" },
  { id: "pr_nordic_acc", supplierId: "nordic", category: "accessory", marginPct: 50, note: "Nordic — levný nákup příslušenství" },
];

/**
 * Vzhled dekoru pro generované „feedové“ fotky (viz `decor-render.ts`): `color` je cílová průměrná barva
 * dekoru (sRGB) — výsledná fotka se na ni kalibruje. `room` = interiérová fotka, jen pokud tón podlahy
 * na ní zhruba odpovídá dekoru (jinak žádná). `format` = rozměr dílce, pokud se liší od kolekce (dlaždice).
 */
export interface SeedDecor { decor: string; tone: DecorTone; color: string; look: DecorLook; room?: string; format?: [number, number]; stock: number; days: number; priceAdj?: number; noWeight?: boolean }

export interface SeedCollection {
  supplier: Supplier["id"];
  brand: string;
  collection: string;
  type: FloorType;
  thickness: number;
  wear: WearLayer;
  usageClass: UsageClass;
  lock: LockType;
  plank: [number, number];
  bevel: boolean;
  m2PerPack: number;
  packKg: number;
  heating: boolean;
  underlay: boolean;
  purchase: number;
  description: string;
  decors: SeedDecor[];
}

const WOOD: DecorLook = { kind: "wood" };
const wood = (o: Omit<Extract<DecorLook, { kind: "wood" }>, "kind">): DecorLook => ({ kind: "wood", ...o });

/*
 * Pořadí je záměrné: první produkt daného tónu (FloorTrade = první feed) slouží jako vzor v kroku „Barva“
 * kalkulačky — Dub přírodní (světlý dub), Dub kávový (tmavé dřevo), Dub popelavý (šedá), Beton světlý (kámen a beton).
 */
export const COLLECTIONS: SeedCollection[] = [
  {
    supplier: "floortrade", brand: "Quaro", collection: "Basic SPC 4", type: "spc", thickness: 4, wear: 0.3, usageClass: 31, lock: "click",
    plank: [1220, 183], bevel: false, m2PerPack: 2.23, packKg: 26, heating: true, underlay: false, purchase: 245,
    description: "Cenově dostupné SPC do bytů a méně zatěžovaných místností. Bez integrované podložky — doporučujeme podložku IXPE. Voděodolné, vhodné na podlahové topení.",
    decors: [
      { decor: "Dub přírodní", tone: "light-oak", color: "#c9a77c", look: WOOD, stock: 640, days: 3 },
      { decor: "Dub bělený", tone: "light-oak", color: "#dccfbb", look: wood({ contrast: 0.16, warmth: 0.5 }), stock: 388, days: 3 },
      { decor: "Dub popelavý", tone: "grey", color: "#aca69c", look: wood({ contrast: 0.2, warmth: 0.25 }), room: PHOTOS.roomCorridor, stock: 220, days: 3 },
      { decor: "Dub kávový", tone: "dark-wood", color: "#4e3626", look: wood({ contrast: 0.28 }), room: PHOTOS.roomDark, stock: 176, days: 3 },
      { decor: "Beton světlý", tone: "stone", color: "#c4c0b8", look: { kind: "concrete" }, format: [610, 305], stock: 44, days: 10 },
    ],
  },
  {
    supplier: "floortrade", brand: "Casale", collection: "Composite Comfort 6.5", type: "vinyl-composite", thickness: 6.5, wear: 0.55, usageClass: 33, lock: "click",
    plank: [1500, 228], bevel: true, m2PerPack: 2.05, packKg: 19, heating: true, underlay: true, purchase: 720,
    description: "Široké dlouhé lamely na kompozitním jádru s integrovanou korkovou podložkou. Výjimečně tichý a teplý došlap, voděodolné jádro, hluboce embosovaná struktura synchronní s dekorem.",
    decors: [
      { decor: "Dub Provence", tone: "light-oak", color: "#cdb796", look: wood({ contrast: 0.2, warmth: 0.7 }), stock: 180, days: 4 },
      { decor: "Dub karamelový", tone: "dark-wood", color: "#9c6436", look: wood({ contrast: 0.25 }), room: PHOTOS.roomWarm, stock: 96, days: 4 },
      { decor: "Dub stříbrný", tone: "grey", color: "#b3b2ae", look: wood({ contrast: 0.18, warmth: 0 }), room: PHOTOS.roomCorridor, stock: 110, days: 4 },
      { decor: "Terrazzo světlé", tone: "stone", color: "#d6d2c9", look: { kind: "terrazzo" }, format: [610, 610], room: PHOTOS.roomLightHall, stock: 62, days: 8 },
    ],
  },
  {
    supplier: "floortrade", brand: "Casale", collection: "Herringbone 6.5", type: "vinyl-composite", thickness: 6.5, wear: 0.55, usageClass: 33, lock: "click",
    plank: [720, 120], bevel: true, m2PerPack: 1.73, packKg: 16, heating: true, underlay: true, purchase: 810,
    description: "Kratší lamely určené pro pokládku do rybí kosti. Kompozitní jádro s integrovanou podložkou, click zámek pro vzor rybí kost (pravé a levé lamely v balení).",
    decors: [
      { decor: "Dub rybí kost přírodní", tone: "light-oak", color: "#c8a476", look: WOOD, stock: 74, days: 8 },
      { decor: "Dub rybí kost kouřový", tone: "dark-wood", color: "#6c4c35", look: wood({ contrast: 0.26 }), room: PHOTOS.texHerringbone, stock: 41, days: 8 },
    ],
  },
  {
    supplier: "vinylia", brand: "Terrano", collection: "Rigid Stone 5.5", type: "spc", thickness: 5.5, wear: 0.55, usageClass: 33, lock: "click",
    plank: [1220, 180], bevel: true, m2PerPack: 2.2, packKg: 30, heating: true, underlay: true, purchase: 520,
    description: "Prémiové SPC s minerálním jádrem a integrovanou IXPE podložkou 1,5 mm. Rozměrově stabilní, 100 % voděodolné, s tlumením kročejového hluku. Vhodné do všech místností včetně koupelen a na podlahové topení.",
    decors: [
      { decor: "Dub skandinávský", tone: "light-oak", color: "#dac8ac", look: wood({ grain: "calm", contrast: 0.17, warmth: 0.6 }), stock: 486, days: 5 },
      { decor: "Dub medový", tone: "light-oak", color: "#c58f55", look: wood({ contrast: 0.24 }), room: PHOTOS.roomWarm, stock: 312, days: 5 },
      { decor: "Dub kouřový", tone: "dark-wood", color: "#6b5545", look: wood({ contrast: 0.26, warmth: 0.6 }), stock: 198, days: 5 },
      { decor: "Ořech tmavý", tone: "dark-wood", color: "#5a3a27", look: wood({ grain: "bold", contrast: 0.3 }), room: PHOTOS.roomDark, stock: 92, days: 7 },
      { decor: "Dub šedý", tone: "grey", color: "#9d9991", look: wood({ contrast: 0.22, warmth: 0.1 }), stock: 264, days: 5 },
      { decor: "Beton šedý", tone: "stone", color: "#8f8d88", look: { kind: "concrete" }, format: [610, 305], room: PHOTOS.roomSlate, stock: 140, days: 7 },
    ],
  },
  {
    supplier: "nordic", brand: "Nordwood", collection: "Nature HDF 9", type: "vinyl-hdf", thickness: 9.5, wear: 0.4, usageClass: 32, lock: "click",
    plank: [1210, 190], bevel: true, m2PerPack: 1.84, packKg: 18, heating: true, underlay: false, purchase: 440,
    description: "Vinyl na HDF desce: teplý a tichý došlap, autentická struktura dřeva s V-fázou. Do suchých místností — obývací pokoje, ložnice, pracovny. Není vhodný do koupelny.",
    decors: [
      { decor: "Dub alpský", tone: "light-oak", color: "#d4c09f", look: wood({ contrast: 0.2, warmth: 0.8 }), stock: 210, days: 6 },
      { decor: "Dub latte", tone: "light-oak", color: "#c2a685", look: wood({ contrast: 0.22, warmth: 0.8 }), stock: 155, days: 6 },
      { decor: "Jasan světlý", tone: "light-oak", color: "#e0d3ba", look: wood({ grain: "calm", contrast: 0.2, warmth: 0.6 }), stock: 98, days: 8, noWeight: true },
      { decor: "Dub antik", tone: "dark-wood", color: "#86664c", look: wood({ grain: "bold", contrast: 0.32 }), room: PHOTOS.roomMinimal, stock: 120, days: 6 },
      { decor: "Borovice šedá", tone: "grey", color: "#a6a39c", look: wood({ grain: "bold", contrast: 0.26, warmth: 0.15 }), stock: 67, days: 8 },
    ],
  },
  {
    supplier: "vinylia", brand: "Lumea", collection: "Glue Down 2.5", type: "vinyl-glue", thickness: 2.5, wear: 0.55, usageClass: 33, lock: "glue",
    plank: [1219, 184], bevel: false, m2PerPack: 3.37, packKg: 15, heating: true, underlay: false, purchase: 390,
    description: "Lepené vinylové dílce (LVT) s nášlapem 0,55 mm. Nejnižší konstrukční výška, ideální na podlahové topení a do rekonstrukcí s omezenou výškou. Vyžaduje rovný podklad a disperzní lepidlo.",
    decors: [
      { decor: "Dub vanilkový", tone: "light-oak", color: "#ddcba6", look: wood({ grain: "calm", contrast: 0.17 }), stock: 320, days: 5 },
      { decor: "Dub uhlový", tone: "dark-wood", color: "#3d3733", look: wood({ contrast: 0.3, warmth: 0.3 }), stock: 145, days: 5 },
      { decor: "Dub grafit", tone: "grey", color: "#646360", look: wood({ contrast: 0.26, warmth: 0 }), stock: 200, days: 5 },
      { decor: "Travertin béžový", tone: "stone", color: "#cdb999", look: { kind: "travertine" }, format: [610, 305], stock: 260, days: 5 },
      { decor: "Mramor bílý", tone: "stone", color: "#e5e3df", look: { kind: "marble" }, format: [610, 610], room: PHOTOS.roomMarble, stock: 88, days: 9 },
      { decor: "Břidlice tmavá", tone: "stone", color: "#4b4e52", look: { kind: "slate", variation: 0.08 }, format: [610, 305], stock: 132, days: 7 },
    ],
  },
  {
    supplier: "vinylia", brand: "Terrano", collection: "Rigid Stone XL Commercial", type: "spc", thickness: 6, wear: 0.55, usageClass: 42, lock: "click",
    plank: [1800, 228], bevel: true, m2PerPack: 2.46, packKg: 34, heating: true, underlay: true, purchase: 620,
    description: "Komerční SPC třídy 42 v XL formátu 1 800 × 228 mm. Pro kanceláře, obchody, hotely a společné prostory. Integrovaná podložka, zvýšená odolnost proti otěru a kolečkovým židlím.",
    decors: [
      { decor: "Dub písečný", tone: "light-oak", color: "#d0b892", look: wood({ contrast: 0.2 }), stock: 520, days: 6 },
      { decor: "Wenge", tone: "dark-wood", color: "#3f2b20", look: wood({ grain: "bold", contrast: 0.36 }), room: PHOTOS.roomDark, stock: 240, days: 6 },
      { decor: "Kámen antracit", tone: "stone", color: "#4a4b4d", look: { kind: "granite" }, format: [914, 457], room: PHOTOS.roomSlate, stock: 310, days: 6 },
    ],
  },
  {
    supplier: "nordic", brand: "Quaro", collection: "Self-Stick 2", type: "vinyl-glue", thickness: 2, wear: 0.3, usageClass: 23, lock: "self-adhesive",
    plank: [914, 152], bevel: false, m2PerPack: 2.5, packKg: 9, heating: false, underlay: false, purchase: 190,
    description: "Samolepicí vinylové lamely pro rychlou renovaci: stačí stáhnout ochrannou fólii a lamelu přitlačit k podkladu. Jen do bytových prostor s nízkou zátěží, na rovný, hladký, čistý a suchý podklad bez prachu. Není určeno na podlahové topení.",
    decors: [
      { decor: "Dub světlý", tone: "light-oak", color: "#d3b88e", look: wood({ contrast: 0.2 }), stock: 900, days: 3 },
      { decor: "Dub tmavý", tone: "dark-wood", color: "#5e4330", look: wood({ contrast: 0.26 }), stock: 450, days: 3 },
    ],
  },
];

/** Rozměr dílce dekoru (dlaždice u kamenných dekorů, jinak lamela kolekce). */
export const decorPlank = (c: SeedCollection, d: SeedDecor): [number, number] => d.format ?? c.plank;

/** Cesta ke generované „fotce od dodavatele“ (vykreslí ji seed, viz `decor-render.ts`). */
export const DEMO_IMAGE_DIR = "data/feeds/demo-images";
export const decorImageUrl = (c: SeedCollection, d: SeedDecor) => `file://${DEMO_IMAGE_DIR}/${slug(skuFor(c, d))}.webp`;
export const accessoryImageUrl = (sku: string) => `file://${DEMO_IMAGE_DIR}/acc-${slug(sku)}.webp`;
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export interface SeedAccessory {
  supplier: Supplier["id"]; sku: string; name: string; kind: AccessoryKind; unit: AccessoryUnit; coverage: number; coverageLabel: string;
  kg: number; purchase: number; tones: DecorTone[]; heating: boolean; stock: number; days: number; image: string | null; description: string;
  /** Generovaná produktová fotka (seed ji vykreslí do `image`). */
  visual?: AccessoryVisual;
}

export const ACCESSORIES: SeedAccessory[] = [
  { supplier: "floortrade", sku: "ACC-UND-IXPE15", name: "Podložka IXPE 1,5 mm (15 m²)", kind: "underlay", unit: "role", coverage: 15, coverageLabel: "15 m² / role", kg: 3.5, purchase: 210, tones: [], heating: false, stock: 320, days: 3, image: accessoryImageUrl("ACC-UND-IXPE15"), visual: { kind: "underlay", color: "#e8e8e5" }, description: "Pěnová podložka pod click vinyl a SPC bez integrované podložky. Vyrovná drobné nerovnosti, tlumí kročejový hluk." },
  { supplier: "floortrade", sku: "ACC-UND-THERMO12", name: "Podložka Thermo 1,2 mm pod podlahové topení (15 m²)", kind: "underlay", unit: "role", coverage: 15, coverageLabel: "15 m² / role", kg: 3, purchase: 265, tones: [], heating: true, stock: 180, days: 3, image: accessoryImageUrl("ACC-UND-THERMO12"), visual: { kind: "underlay", color: "#c3c6c8", foil: true }, description: "Podložka s nízkým tepelným odporem (0,01 m²K/W) určená pod podlahové topení. Parozábrana integrovaná." },
  { supplier: "vinylia", sku: "VN-SKT-60-LIGHT", name: "Soklová lišta MDF 60 mm — Dub světlý (2,4 m)", kind: "skirting", unit: "ks", coverage: 2.4, coverageLabel: "2,4 m / ks", kg: 0.9, purchase: 85, tones: ["light-oak"], heating: false, stock: 1200, days: 5, image: accessoryImageUrl("VN-SKT-60-LIGHT"), visual: { kind: "skirting", color: "#cfb18a", wood: true, floor: "#c9a77c" }, description: "Foliovaná MDF lišta 60 × 15 mm s kabelovým kanálkem. Odstín sladěný se světlými dubovými dekory." },
  { supplier: "vinylia", sku: "VN-SKT-60-DARK", name: "Soklová lišta MDF 60 mm — Dub tmavý (2,4 m)", kind: "skirting", unit: "ks", coverage: 2.4, coverageLabel: "2,4 m / ks", kg: 0.9, purchase: 85, tones: ["dark-wood"], heating: false, stock: 640, days: 5, image: accessoryImageUrl("VN-SKT-60-DARK"), visual: { kind: "skirting", color: "#5a3f2d", wood: true, floor: "#4e3626" }, description: "Foliovaná MDF lišta 60 × 15 mm s kabelovým kanálkem. Odstín pro tmavé dřevěné dekory." },
  { supplier: "vinylia", sku: "VN-SKT-60-GREY", name: "Soklová lišta MDF 60 mm — Šedá (2,4 m)", kind: "skirting", unit: "ks", coverage: 2.4, coverageLabel: "2,4 m / ks", kg: 0.9, purchase: 85, tones: ["grey"], heating: false, stock: 380, days: 5, image: accessoryImageUrl("VN-SKT-60-GREY"), visual: { kind: "skirting", color: "#a3a19c", wood: false, floor: "#aca69c" }, description: "Foliovaná MDF lišta 60 × 15 mm s kabelovým kanálkem. Šedý odstín." },
  { supplier: "vinylia", sku: "VN-SKT-60-WHITE", name: "Soklová lišta MDF 60 mm — Bílá (2,4 m)", kind: "skirting", unit: "ks", coverage: 2.4, coverageLabel: "2,4 m / ks", kg: 0.9, purchase: 79, tones: ["stone"], heating: false, stock: 2100, days: 5, image: accessoryImageUrl("VN-SKT-60-WHITE"), visual: { kind: "skirting", color: "#f2f1ed", wood: false, floor: "#c9a77c" }, description: "Bílá lakovaná MDF lišta 60 × 15 mm. Univerzální ke kamenným a betonovým dekorům i k bílým stěnám." },
  { supplier: "nordic", sku: "NF-TRN-90-SILVER", name: "Přechodová lišta samolepicí 90 cm — stříbrná", kind: "transition", unit: "ks", coverage: 1, coverageLabel: "1 ks / dveře", kg: 0.3, purchase: 120, tones: ["grey", "stone"], heating: false, stock: 400, days: 4, image: accessoryImageUrl("NF-TRN-90-SILVER"), visual: { kind: "transition", metal: "silver", left: "#c9a77c", right: "#8f8d88" }, description: "Hliníková samolepicí přechodová lišta 38 mm pro spojení podlah ve stejné výšce." },
  { supplier: "nordic", sku: "NF-TRN-90-OAK", name: "Přechodová lišta samolepicí 90 cm — dub", kind: "transition", unit: "ks", coverage: 1, coverageLabel: "1 ks / dveře", kg: 0.3, purchase: 135, tones: ["light-oak", "dark-wood"], heating: false, stock: 260, days: 4, image: accessoryImageUrl("NF-TRN-90-OAK"), visual: { kind: "transition", metal: "oak", left: "#c9a77c", right: "#c4c0b8" }, description: "Hliníková samolepicí přechodová lišta 38 mm s dřevodekorem." },
  { supplier: "floortrade", sku: "ACC-GLUE-SKT300", name: "Montážní lepidlo na lišty 300 ml", kind: "glue", unit: "ks", coverage: 20, coverageLabel: "1 ks / 20 m lišt", kg: 0.4, purchase: 95, tones: [], heating: false, stock: 500, days: 3, image: null, description: "Hybridní montážní lepidlo pro lepení soklových lišt na zdivo i sádrokarton." },
  { supplier: "floortrade", sku: "ACC-SIL-310", name: "Akrylový tmel na lišty 310 ml — bílý", kind: "silicone", unit: "ks", coverage: 15, coverageLabel: "1 ks / 15 m lišt", kg: 0.45, purchase: 70, tones: [], heating: false, stock: 800, days: 3, image: null, description: "Přetíratelný akrylový tmel na spáru mezi lištou a stěnou." },
  { supplier: "vinylia", sku: "VN-ADH-LVT-6", name: "Disperzní lepidlo na vinyl 6 kg", kind: "floor-adhesive", unit: "balení", coverage: 20, coverageLabel: "6 kg ≈ 20 m²", kg: 6.5, purchase: 690, tones: [], heating: true, stock: 90, days: 5, image: null, description: "Disperzní lepidlo pro celoplošné lepení LVT dílců, vhodné na podlahové topení. Spotřeba cca 300 g/m²." },
  { supplier: "nordic", sku: "NF-CLEAN-SET", name: "Čisticí sada na vinylové podlahy", kind: "cleaning", unit: "balení", coverage: 1, coverageLabel: "1 sada", kg: 1.2, purchase: 320, tones: [], heating: false, stock: 150, days: 4, image: null, description: "Mop s mikrovláknem, rozprašovač a 1 l neutrálního čističe na vinyl a SPC." },
];

// --- Generátory mock XML ---------------------------------------------------
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const skuFor = (c: SeedCollection, d: SeedDecor) => `${c.brand.slice(0, 3).toUpperCase()}-${c.collection.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase()}-${d.decor.replace(/[^A-Za-zěščřžýáíéúůĚŠČŘŽÝÁÍÉÚŮ0-9]/g, "").slice(0, 18).toUpperCase()}`;
const priceFor = (c: SeedCollection, d: SeedDecor) => Math.round(c.purchase * (1 + (d.priceAdj ?? 0)));

export function buildFloortradeXml(collections: SeedCollection[], acc: SeedAccessory[]) {
  const items = collections.filter((c) => c.supplier === "floortrade").flatMap((c) => c.decors.map((d) => `
  <SHOPITEM>
    <ITEM_ID>${esc(skuFor(c, d))}</ITEM_ID>
    <PRODUCTNAME>${esc(`${c.collection} ${d.decor}`)}</PRODUCTNAME>
    <MANUFACTURER>${esc(c.brand)}</MANUFACTURER>
    <CATEGORYTEXT>Podlahy | Vinylové podlahy</CATEGORYTEXT>
    <DESCRIPTION>${esc(c.description)}</DESCRIPTION>
    <PRICE>${priceFor(c, d)}</PRICE>
    <STOCK>${d.stock}</STOCK>
    <DELIVERY_DATE>${d.days}</DELIVERY_DATE>
    ${d.noWeight ? "" : `<WEIGHT>${c.packKg}</WEIGHT>`}
    <IMGURL>${esc(decorImageUrl(c, d))}</IMGURL>
    ${d.room ? `<IMGURL_ALTERNATIVE>${esc(d.room)}</IMGURL_ALTERNATIVE>` : ""}
    <PARAM><PARAM_NAME>Kolekce</PARAM_NAME><VAL>${esc(c.collection)}</VAL></PARAM>
    <PARAM><PARAM_NAME>Dekor</PARAM_NAME><VAL>${esc(d.decor)}</VAL></PARAM>
    <PARAM><PARAM_NAME>Typ</PARAM_NAME><VAL>${esc({ spc: "SPC", "vinyl-hdf": "Vinyl na HDF", "vinyl-composite": "Vinyl na kompozitu", "vinyl-glue": "Lepený vinyl" }[c.type])}</VAL></PARAM>
    <PARAM><PARAM_NAME>Tloušťka</PARAM_NAME><VAL>${String(c.thickness).replace(".", ",")} mm</VAL></PARAM>
    <PARAM><PARAM_NAME>Nášlapná vrstva</PARAM_NAME><VAL>${String(c.wear).replace(".", ",")} mm</VAL></PARAM>
    <PARAM><PARAM_NAME>Třída zátěže</PARAM_NAME><VAL>${c.usageClass}</VAL></PARAM>
    <PARAM><PARAM_NAME>Pokládka</PARAM_NAME><VAL>${c.lock === "click" ? "Click zámek" : c.lock === "glue" ? "Lepení" : "Samolepicí"}</VAL></PARAM>
    <PARAM><PARAM_NAME>Rozměr lamely</PARAM_NAME><VAL>${decorPlank(c, d)[0]} x ${decorPlank(c, d)[1]} mm</VAL></PARAM>
    <PARAM><PARAM_NAME>Fáza</PARAM_NAME><VAL>${c.bevel ? "ano" : "ne"}</VAL></PARAM>
    <PARAM><PARAM_NAME>m2 v balení</PARAM_NAME><VAL>${String(c.m2PerPack).replace(".", ",")}</VAL></PARAM>
    <PARAM><PARAM_NAME>Podlahové topení</PARAM_NAME><VAL>${c.heating ? "ano" : "ne"}</VAL></PARAM>
    <PARAM><PARAM_NAME>Integrovaná podložka</PARAM_NAME><VAL>${c.underlay ? "ano" : "ne"}</VAL></PARAM>
  </SHOPITEM>`));
  const accItems = acc.filter((a) => a.supplier === "floortrade").map((a) => `
  <SHOPITEM>
    <ITEM_ID>${esc(a.sku)}</ITEM_ID>
    <PRODUCTNAME>${esc(a.name)}</PRODUCTNAME>
    <CATEGORYTEXT>Podlahy | Příslušenství</CATEGORYTEXT>
    <DESCRIPTION>${esc(a.description)}</DESCRIPTION>
    <PRICE>${a.purchase}</PRICE>
    <STOCK>${a.stock}</STOCK>
    <DELIVERY_DATE>${a.days}</DELIVERY_DATE>
    <WEIGHT>${a.kg}</WEIGHT>
    ${a.image ? `<IMGURL>${esc(a.image)}</IMGURL>` : ""}
    <PARAM><PARAM_NAME>Druh</PARAM_NAME><VAL>${esc({ underlay: "Podložka", skirting: "Soklová lišta", transition: "Přechodová lišta", glue: "Lepidlo na lišty", silicone: "Silikon", cleaning: "Čisticí sada", "floor-adhesive": "Lepidlo na podlahu" }[a.kind])}</VAL></PARAM>
    <PARAM><PARAM_NAME>Jednotka</PARAM_NAME><VAL>${a.unit}</VAL></PARAM>
    <PARAM><PARAM_NAME>Pokrytí</PARAM_NAME><VAL>${a.coverage}</VAL></PARAM>
    <PARAM><PARAM_NAME>Pokrytí popis</PARAM_NAME><VAL>${esc(a.coverageLabel)}</VAL></PARAM>
    <PARAM><PARAM_NAME>Odstíny</PARAM_NAME><VAL>${a.tones.join(",")}</VAL></PARAM>
    <PARAM><PARAM_NAME>Podlahové topení</PARAM_NAME><VAL>${a.heating ? "ano" : "ne"}</VAL></PARAM>
  </SHOPITEM>`);
  return `<?xml version="1.0" encoding="utf-8"?>\n<SHOP>${items.join("")}${accItems.join("")}\n</SHOP>\n`;
}

export function buildVinyliaXml(collections: SeedCollection[], acc: SeedAccessory[]) {
  const items = collections.filter((c) => c.supplier === "vinylia").flatMap((c) => c.decors.map((d) => `
  <product sku="${esc(skuFor(c, d))}" kind="floor">
    <name>${esc(`${c.collection} ${d.decor}`)}</name>
    <brand>${esc(c.brand)}</brand>
    <collection>${esc(c.collection)}</collection>
    <decor>${esc(d.decor)}</decor>
    <tone>${d.tone}</tone>
    <core>${c.type === "spc" ? "SPC" : c.type === "vinyl-hdf" ? "HDF" : c.type === "vinyl-composite" ? "WPC composite" : "LVT glue-down"}</core>
    <thickness_mm>${c.thickness}</thickness_mm>
    <wear_layer_mm>${c.wear}</wear_layer_mm>
    <usage_class>${c.usageClass}</usage_class>
    <installation>${c.lock}</installation>
    <plank_length_mm>${decorPlank(c, d)[0]}</plank_length_mm>
    <plank_width_mm>${decorPlank(c, d)[1]}</plank_width_mm>
    <bevel>${c.bevel ? 1 : 0}</bevel>
    <pack_m2>${c.m2PerPack}</pack_m2>
    ${d.noWeight ? "" : `<pack_kg>${c.packKg}</pack_kg>`}
    <underfloor_heating>${c.heating ? 1 : 0}</underfloor_heating>
    <integrated_underlay>${c.underlay ? 1 : 0}</integrated_underlay>
    <stock_m2>${d.stock}</stock_m2>
    <lead_time_days>${d.days}</lead_time_days>
    <price_net>${priceFor(c, d)}</price_net>
    <image>${esc(decorImageUrl(c, d))}</image>
    ${d.room ? `<image_room>${esc(d.room)}</image_room>` : ""}
    <description>${esc(c.description)}</description>
  </product>`));
  const accItems = acc.filter((a) => a.supplier === "vinylia").map((a) => `
  <product sku="${esc(a.sku)}" kind="accessory">
    <name>${esc(a.name)}</name>
    <accessory_type>${a.kind}</accessory_type>
    <unit>${a.unit}</unit>
    <coverage>${a.coverage}</coverage>
    <coverage_label>${esc(a.coverageLabel)}</coverage_label>
    <unit_kg>${a.kg}</unit_kg>
    <price_net>${a.purchase}</price_net>
    <tones>${a.tones.join(",")}</tones>
    <underfloor_heating>${a.heating ? 1 : 0}</underfloor_heating>
    <stock_units>${a.stock}</stock_units>
    <lead_time_days>${a.days}</lead_time_days>
    ${a.image ? `<image>${esc(a.image)}</image>` : ""}
    <description>${esc(a.description)}</description>
  </product>`);
  return `<?xml version="1.0" encoding="utf-8"?>\n<products generated="${new Date().toISOString()}">${items.join("")}${accItems.join("")}\n</products>\n`;
}

export function buildNordicXml(collections: SeedCollection[], acc: SeedAccessory[]) {
  const items = collections.filter((c) => c.supplier === "nordic").flatMap((c) => c.decors.map((d) => `
  <item id="${esc(skuFor(c, d))}" type="floor">
    <title>${esc(`${c.collection} ${d.decor}`)}</title>
    <brand>${esc(c.brand)}</brand>
    <series>${esc(c.collection)}</series>
    <decor>${esc(d.decor)}</decor>
    <attrs core="${c.type === "spc" ? "spc" : c.type === "vinyl-hdf" ? "hdf" : c.type === "vinyl-composite" ? "composite" : "lvt"}" thickness="${c.thickness}" wear="${c.wear}" class="${c.usageClass}" install="${c.lock}" length="${decorPlank(c, d)[0]}" width="${decorPlank(c, d)[1]}" bevel="${c.bevel ? 1 : 0}" pack_m2="${c.m2PerPack}"${d.noWeight ? "" : ` pack_kg="${c.packKg}"`} ufh="${c.heating ? 1 : 0}" underlay="${c.underlay ? 1 : 0}" tone="${d.tone}" />
    <price net="${priceFor(c, d)}" currency="CZK" />
    <stock unit="m2" qty="${d.stock}" lead="${d.days}" />
    <images><img>${esc(decorImageUrl(c, d))}</img>${d.room ? `<img>${esc(d.room)}</img>` : ""}</images>
    <description>${esc(c.description)}</description>
  </item>`));
  const accItems = acc.filter((a) => a.supplier === "nordic").map((a) => `
  <item id="${esc(a.sku)}" type="accessory">
    <title>${esc(a.name)}</title>
    <attrs kind="${a.kind}" unit="${a.unit}" coverage="${a.coverage}" coverage_label="${esc(a.coverageLabel)}" kg="${a.kg}" tones="${a.tones.join(",")}" ufh="${a.heating ? 1 : 0}" />
    <price net="${a.purchase}" currency="CZK" />
    <stock unit="${a.unit}" qty="${a.stock}" lead="${a.days}" />
    ${a.image ? `<images><img>${esc(a.image)}</img></images>` : ""}
    <description>${esc(a.description)}</description>
  </item>`);
  return `<?xml version="1.0" encoding="utf-8"?>\n<catalog supplier="Nordic Floors">${items.join("")}${accItems.join("")}\n</catalog>\n`;
}

export const FEED_BUILDERS: Record<Supplier["id"], (c: SeedCollection[], a: SeedAccessory[]) => string> = {
  floortrade: buildFloortradeXml,
  vinylia: buildVinyliaXml,
  nordic: buildNordicXml,
};
