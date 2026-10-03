// ---------------------------------------------------------------------------
// Doménový model vinylpodlahy.cz
// Normalizovaný produkt je nezávislý na tom, jak pole pojmenoval dodavatel.
// ---------------------------------------------------------------------------

export type FloorType = "spc" | "vinyl-hdf" | "vinyl-composite" | "vinyl-glue";
export type LockType = "click" | "glue" | "self-adhesive";
export type UsageClass = 23 | 31 | 32 | 33 | 42;
export type WearLayer = 0.3 | 0.4 | 0.55;
export type DecorTone = "light-oak" | "dark-wood" | "grey" | "stone";
export type ProductStatus = "active" | "paused" | "hidden";

export const FLOOR_TYPE_LABEL: Record<FloorType, string> = {
  spc: "SPC",
  "vinyl-hdf": "Vinyl na HDF",
  "vinyl-composite": "Vinyl na kompozitu",
  "vinyl-glue": "Lepený vinyl",
};

export const LOCK_LABEL: Record<LockType, string> = {
  click: "Click zámek",
  glue: "Lepený",
  "self-adhesive": "Samolepicí",
};

export const DECOR_TONE_LABEL: Record<DecorTone, string> = {
  "light-oak": "Světlý dub",
  "dark-wood": "Tmavé dřevo",
  grey: "Šedá",
  stone: "Kámen a beton",
};

export interface ImageSource {
  /** Původní URL/cesta z feedu (http(s):// nebo file://). Nikdy se nehotlinkuje. */
  url: string;
  /** Volitelná úprava při přegenerování (u demo datasetu vytváří odlišné odstíny). */
  transform?: { brightness?: number; saturation?: number; hue?: number; crop?: "center" | "top" | "bottom" };
}

export interface ProductImages {
  /** Vlastní kopie v /public/media/products/{id}/… (webp). */
  card: string | null;
  hero: string | null;
  swatch: string | null;
  gallery: string[];
  /** Zdroje z feedu, ze kterých se kopie generují. */
  sources: { texture: ImageSource; room?: ImageSource };
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  collection: string;
  decor: string;
  decorTone: DecorTone;
  type: FloorType;
  thicknessMm: number;
  wearLayerMm: WearLayer;
  usageClass: UsageClass;
  lock: LockType;
  plankLengthMm: number;
  plankWidthMm: number;
  bevel: boolean;
  m2PerPack: number;
  /** POVINNÉ pro výpočet dopravy. Pokud feed neposlal, je odhadnuto z typu a weightEstimated=true. */
  packWeightKg: number;
  weightEstimated: boolean;
  floorHeating: boolean;
  integratedUnderlay: boolean;
  waterproof: boolean;
  /** Dostupnost z feedu (m²) a prodejná dostupnost po odečtení bezpečnostní rezervy. */
  stockM2Raw: number;
  stockM2: number;
  deliveryDays: number;
  /** Nákupní cena bez DPH za m² (z feedu). */
  purchasePriceM2: number;
  /** Uplatněná marže v % (vyřešená z pravidel; může být přepsána ručně). */
  marginPct: number;
  marginOverridePct: number | null;
  /** Prodejní ceny vč. DPH, zaokrouhlené na Kč. */
  pricePerM2: number;
  pricePerPack: number;
  supplierId: string;
  supplierSku: string;
  images: ProductImages;
  status: ProductStatus;
  pauseReason: string | null;
  isNew: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type AccessoryKind = "underlay" | "skirting" | "transition" | "glue" | "silicone" | "cleaning" | "floor-adhesive";
export type AccessoryUnit = "role" | "ks" | "m" | "balení";

export const ACCESSORY_KIND_LABEL: Record<AccessoryKind, string> = {
  underlay: "Podložka",
  skirting: "Soklová lišta",
  transition: "Přechodová lišta",
  glue: "Lepidlo",
  silicone: "Silikon",
  cleaning: "Čisticí sada",
  "floor-adhesive": "Lepidlo na podlahu",
};

export interface Accessory {
  id: string;
  slug: string;
  name: string;
  kind: AccessoryKind;
  unit: AccessoryUnit;
  /** Pokrytí jedné jednotky: podložka m²/role, lišta m/ks, lepidlo m lišt/ks, silikon m lišt/ks. */
  coverage: number;
  coverageLabel: string;
  unitWeightKg: number;
  purchasePrice: number;
  marginPct: number;
  marginOverridePct: number | null;
  pricePerUnit: number;
  supplierId: string;
  supplierSku: string;
  /** Pro lišty: ke kterým odstínům dekoru se hodí. */
  decorTones: DecorTone[];
  /** Pro podložky: vhodná pod podlahové topení. */
  floorHeating: boolean;
  stockUnits: number;
  deliveryDays: number;
  image: string | null;
  status: ProductStatus;
  description: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  /** Zdroj XML feedu — http(s):// nebo file:// (relativně ke kořeni projektu). */
  feedUrl: string;
  adapter: "floortrade" | "vinylia" | "nordic";
  /** Reálná zásilka jde od dodavatele; odkud vyjíždí (jen informativně). */
  shipsFrom: string;
  lastSyncAt: string | null;
  lastSyncStatus: "ok" | "failed" | "never";
  active: boolean;
}

export type PricingCategory = "floor" | "accessory";

export interface PricingRule {
  id: string;
  /** null = platí pro všechny dodavatele */
  supplierId: string | null;
  /** null = platí pro všechny kategorie */
  category: PricingCategory | null;
  marginPct: number;
  note: string;
}

export interface ShippingTier {
  maxKg: number;
  price: number;
  label: string;
}

export interface Settings {
  vatRate: number;
  freeShippingFromM2: number;
  stockSafetyPct: number;
  priceJumpAlertPct: number;
  shipping: {
    parcelMaxKg: number;
    parcelPrice: number;
    parcelAdditionalPrice: number;
    palletThresholdKg: number;
    palletTiers: ShippingTier[];
    carryUpParcelPrice: number;
    carryUpPalletPricePerFloor: number;
  };
  samples: { min: number; max: number };
  /** Odhad hmotnosti (kg/m²) pro produkty, kterým feed neposlal hmotnost balení. */
  weightEstimateKgPerM2: Record<FloorType, number>;
}

export type LayoutMode = "straight" | "diagonal" | "herringbone";

export const LAYOUT_LABEL: Record<LayoutMode, string> = {
  straight: "Rovně",
  diagonal: "Diagonálně",
  herringbone: "Rybí kost",
};

export const LAYOUT_WASTE: Record<LayoutMode, number> = {
  straight: 0.05,
  diagonal: 0.1,
  herringbone: 0.15,
};

export interface RoomInput {
  id: string;
  name: string;
  mode: "dims" | "area";
  lengthM: number | null;
  widthM: number | null;
  areaM2: number | null;
  perimeterM: number | null;
  layout: LayoutMode;
  doors: number;
  floorHeating: boolean;
  /** Typ místnosti z kalkulačky (čip u rozměrů) — z něj se odvodí pravidla výběru. */
  kind?: RoomKind | null;
}

export interface CalcOptions {
  reservePack: boolean;
  includeUnderlay: boolean;
  includeSkirting: boolean;
  includeTransitions: boolean;
}

export interface CalcLine {
  kind: "product" | "accessory";
  refId: string;
  name: string;
  detail: string;
  qty: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  skipped?: string;
}

export interface CalcResult {
  rooms: {
    id: string;
    name: string;
    areaM2: number;
    perimeterM: number;
    perimeterEstimated: boolean;
    wastePct: number;
    areaWithWasteM2: number;
    doors: number;
  }[];
  totalAreaM2: number;
  totalAreaWithWasteM2: number;
  totalPerimeterM: number;
  totalDoors: number;
  packs: number;
  packsWithoutReserve: number;
  coveredAreaM2: number;
  anyFloorHeating: boolean;
  lines: CalcLine[];
  /** Součet položek (zboží) bez dopravy. */
  total: number;
  /**
   * Doprava stejnou logikou jako košík (zásilky podle dodavatele, bez vynášky).
   * Celý projekt = total + shipping.total. Chybí u kalkulací uložených před zavedením.
   */
  shipping?: CalcShipping;
  warnings: string[];
}

export interface CalcShipping {
  total: number;
  shipments: { supplierId: string; label: string; method: "parcel" | "pallet"; methodLabel: string; price: number; free: boolean; floorM2: number }[];
}

export type RoomKind = "living" | "bedroom" | "kitchen" | "bathroom" | "hallway" | "commercial";
export type BudgetBand = "lt400" | "400-700" | "700-1000" | "gt1000";

/** Odpovědi z průvodce-kalkulačky. Žádná AI — jen filtrovací pravidla nad parametry. */
export interface WizardAnswers {
  roomKinds: RoomKind[];
  budget: BudgetBand | null;
  style: DecorTone | null;
  floorHeating: boolean;
  kidsPets: boolean;
  integratedUnderlay: boolean;
  diyClick: boolean;
}

export interface Calculation {
  id: string;
  createdAt: string;
  productId: string;
  rooms: RoomInput[];
  options: CalcOptions;
  /** Odpovědi průvodce (pokud kalkulace vznikla v průvodci) — pro „Upravit kalkulaci“. */
  answers?: WizardAnswers | null;
  result: CalcResult;
  /** Snapshot ceny v okamžiku uložení — sdílený odkaz musí ukazovat, co zákazník viděl. */
  productSnapshot: { name: string; pricePerM2: number; pricePerPack: number; m2PerPack: number };
}

export interface SampleRequest {
  id: string;
  createdAt: string;
  email: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  productIds: string[];
  calculationId: string | null;
  /** Historické pole (dřív jeden společný souhlas). Nově = stejná hodnota jako marketingConsent. */
  consent: boolean;
  /** Nepovinný souhlas s navazujícími e-maily (rady, sleva). Zaslání vzorků samo o sobě souhlas nepotřebuje (plnění smlouvy). */
  marketingConsent?: boolean;
  marketingConsentAt?: string | null;
  status: "new" | "sent" | "done";
}

/** Odhlášení z marketingových e-mailů (odkaz /odhlaseni v e-mailech). */
export interface EmailUnsubscribe {
  email: string;
  createdAt: string;
  /** Kolik naplánovaných marketingových e-mailů se zrušilo. */
  cancelled: number;
}

export type EmailType = "sample-confirm" | "sample-reminder-calc" | "sample-discount" | "calc-share";

export interface EmailQueueItem {
  id: string;
  /** U e-mailů ke vzorkům id žádosti; u „calc-share“ (kalkulace na e-mail) prázdné. */
  sampleRequestId: string;
  to: string;
  type: EmailType;
  dueAt: string;
  sentAt: string | null;
  payload: Record<string, unknown>;
}

export interface InstallLead {
  id: string;
  createdAt: string;
  zip: string;
  areaM2: number;
  term: string;
  name: string;
  phone: string;
  email: string;
  note: string;
  productId: string | null;
  calculationId: string | null;
  orderId: string | null;
  source: "product" | "cart" | "page";
  status: "new" | "contacted" | "closed";
}

export interface CartItem {
  kind: "product" | "accessory";
  id: string;
  qty: number;
}

export interface Shipment {
  supplierId: string;
  supplierName: string;
  shipsFrom: string;
  items: { kind: "product" | "accessory"; id: string; name: string; qty: number }[];
  weightKg: number;
  weightEstimated: boolean;
  floorM2: number;
  method: "parcel" | "pallet";
  methodLabel: string;
  basePrice: number;
  freeShipping: boolean;
  price: number;
  carryUpPrice: number;
  deliveryDays: number;
  /** Nejpozdější lhůta položek v zásilce. */
  deliveryLabel: string;
  notes: string[];
}

export interface CartQuoteLine {
  kind: "product" | "accessory";
  id: string;
  slug: string;
  name: string;
  detail: string;
  image: string | null;
  qty: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  supplierId: string;
  available: boolean;
  availabilityNote: string | null;
  m2: number | null;
  /** Nelze objednat (produkt / příslušenství pozastaveno nebo skryto). Na rozdíl od `available:false` kvůli skladu,
   *  kde jde jen o delší lhůtu. Plní API košíku / objednávky (src/lib/orderGuard.ts). */
  blocked?: boolean;
  /** U zablokované položky: kam poslat zákazníka pro náhradu (podobné dekory / příslušenství). */
  alternativesHref?: string;
}

export interface CartQuote {
  lines: CartQuoteLine[];
  shipments: Shipment[];
  itemsTotal: number;
  shippingTotal: number;
  carryUpTotal: number;
  total: number;
  totalFloorM2: number;
  totalWeightKg: number;
  warnings: string[];
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    street: string;
    city: string;
    zip: string;
    note: string;
    /** Nákup na firmu (nepovinné). */
    business?: { company: string; ico: string; dic: string } | null;
  };
  carryUp: { enabled: boolean; floor: number; elevator: boolean };
  installRequested: boolean;
  quote: CartQuote;
  calculationId: string | null;
  payment: "transfer";
  status: "new" | "confirmed" | "shipped" | "done" | "cancelled";
}

export interface FeedRun {
  id: string;
  supplierId: string;
  startedAt: string;
  finishedAt: string;
  status: "ok" | "failed";
  stats: {
    inFeed: number;
    added: number;
    updated: number;
    unchanged: number;
    missing: number;
    pausedPriceJump: number;
    imagesProcessed: number;
  };
  error: string | null;
  snapshotFile: string | null;
}

export type AlertType = "price-jump" | "missing-in-feed" | "feed-failed" | "weight-missing" | "info";

export interface Alert {
  id: string;
  createdAt: string;
  type: AlertType;
  supplierId: string | null;
  productId: string | null;
  message: string;
  acknowledged: boolean;
}

export interface SiteContent {
  hero: { title: string; subtitle: string; ctaPrimary: string; ctaSecondary: string; ctaTertiary: string; image: string };
  usps: { title: string; text: string }[];
  homeIntro: { title: string; text: string };
  steps: { title: string; text: string }[];
  about: { title: string; text: string };
  /** Údaje provozovatele — patička, kontakt a právní stránky. `address` = sídlo provozovatele. */
  contact: { email: string; phone: string; hours: string; company: string; address: string; ico: string; dic: string; registry: string };
  landings: Record<string, { h1: string; intro: string; seoText: string; metaTitle: string; metaDescription: string }>;
  /** Orientační ceny na trhu (materiál, pokládka…) — kontext pro rozpočet zákazníka. */
  priceGuide: { title: string; text: string; rows: { label: string; range: string; note: string }[]; source: string };
  footerNote: string;
}
