import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LOCK_LABEL, type SiteContent } from "./types";
import type { PublicProduct } from "./public";
import { absUrl, SITE_NAME, SITE_URL, SOCIAL_PROFILES } from "./site";

/**
 * JSON-LD se skládá ze stejných dat, ze kterých se renderují stránky (admin → Texty webu, produkty z feedu).
 * Hodnoty, které jsou ještě zástupné („[doplňte IČO]“, telefon samé nuly), se do schema nikdy nedostanou.
 */

/** Je hodnota skutečně vyplněná? (ne prázdná, ne „[doplňte …]“, ne „TODO“, ne telefon ze samých nul) */
export function isFilled(v: string | null | undefined): v is string {
  const s = (v ?? "").trim();
  if (!s) return false;
  if (/\[\s*doplňte|\btodo\b/i.test(s)) return false;
  if (/^[+\d\s()-]+$/.test(s) && !/[1-9]/.test(s.replace(/^\+?420/, ""))) return false;
  return true;
}

/** Odstraní `undefined`, prázdné řetězce, prázdná pole a prázdné objekty (rekurzivně). */
export function compact<T>(value: T): T | undefined {
  if (Array.isArray(value)) {
    const arr = value.map((v) => compact(v)).filter((v) => v !== undefined);
    return (arr.length ? arr : undefined) as T | undefined;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([k, v]) => [k, compact(v)] as const).filter(([, v]) => v !== undefined);
    return (entries.length ? Object.fromEntries(entries) : undefined) as T | undefined;
  }
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

export const ldId = (fragment: string) => `${SITE_URL}/#${fragment}`;

/** Firma jako internetový obchod (`OnlineStore` je podtyp `Organization`). Bez kamenné prodejny není `LocalBusiness`. */
export function organizationLd(contact: SiteContent["contact"]) {
  const email = isFilled(contact.email) ? contact.email.trim() : undefined;
  const phone = isFilled(contact.phone) ? contact.phone.trim() : undefined;
  const ico = isFilled(contact.ico) && /\d{6,8}/.test(contact.ico) ? contact.ico.replace(/\s/g, "") : undefined;
  const dic = isFilled(contact.dic) && /^[A-Z]{2}\d+$/i.test(contact.dic.replace(/\s/g, "")) ? contact.dic.replace(/\s/g, "").toUpperCase() : undefined;
  return compact({
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": ldId("organization"),
    name: SITE_NAME,
    legalName: isFilled(contact.company) ? contact.company.trim() : undefined,
    url: SITE_URL,
    description: "Internetový obchod s vinylovými a SPC podlahami a příslušenstvím. Cenu celého projektu spočítáme na vaše metry: balení, podložku, lišty i dopravu.",
    email,
    telephone: phone,
    address: isFilled(contact.address) ? contact.address.trim() : undefined,
    taxID: ico,
    vatID: dic,
    contactPoint: email || phone ? { "@type": "ContactPoint", contactType: "customer service", email, telephone: phone, availableLanguage: "cs" } : undefined,
    sameAs: SOCIAL_PROFILES.filter(isFilled),
  });
}

/** Web a jeho vyhledávání v katalogu (`/podlahy?q=`). */
export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": ldId("website"),
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "cs-CZ",
    publisher: { "@id": ldId("organization") },
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/podlahy?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}

const prop = (name: string, value: string | number, unitCode?: string) => ({ "@type": "PropertyValue", name, value, unitCode });
const yesNo = (v: boolean) => (v ? "ano" : "ne");

/**
 * Karta produktu. Používá jen veřejnou podobu produktu (`PublicProduct`) — žádná nákupní cena, marže ani SKU dodavatele.
 * `sku` je veřejný slug (interní `id` obsahuje jméno dodavatele). Hodnocení ani recenze se neuvádějí (žádné neexistují).
 * Cena je za balení (to se kupuje), cena za m² je ve vlastnostech. Pozastavený produkt je bez nabídky (cena čeká na potvrzení).
 */
export function productLd(p: PublicProduct) {
  const url = absUrl(`/podlaha/${p.slug}`);
  const name = `${p.brand} ${p.name}`;
  const images = [p.images.hero, p.images.card, ...p.images.gallery].filter((x): x is string => !!x);
  const inStock = p.stockM2 > 0;
  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name,
    description: p.description,
    url,
    sku: p.slug,
    image: [...new Set(images)].map(absUrl),
    brand: { "@type": "Brand", name: p.brand },
    category: FLOOR_TYPE_LABEL[p.type],
    additionalProperty: [
      prop("Typ podlahy", FLOOR_TYPE_LABEL[p.type]),
      prop("Kolekce", p.collection),
      prop("Odstín", DECOR_TONE_LABEL[p.decorTone]),
      prop("Tloušťka", p.thicknessMm, "MMT"),
      prop("Nášlapná vrstva", p.wearLayerMm, "MMT"),
      prop("Třída zátěže", p.usageClass),
      prop("Pokládka", LOCK_LABEL[p.lock]),
      prop("Podlahové topení", yesNo(p.floorHeating)),
      prop("Voděodolná", yesNo(p.waterproof)),
      prop("Integrovaná podložka", yesNo(p.integratedUnderlay)),
      prop("Hrany s fází (V-drážka)", yesNo(p.bevel)),
      prop("Rozměr lamely (délka × šířka)", `${p.plankLengthMm} × ${p.plankWidthMm} mm`),
      prop("Plocha v balení", p.m2PerPack, "MTK"),
      prop("Hmotnost balení", p.packWeightKg, "KGM"),
      prop("Cena za m² vč. DPH", p.pricePerM2),
    ],
    offers: p.status === "paused" ? undefined : {
      "@type": "Offer",
      url,
      priceCurrency: "CZK",
      price: p.pricePerPack,
      priceSpecification: { "@type": "PriceSpecification", price: p.pricePerPack, priceCurrency: "CZK", valueAddedTaxIncluded: true },
      eligibleQuantity: { "@type": "QuantitativeValue", value: p.m2PerPack, unitCode: "MTK", unitText: "m²" },
      description: `Cena za balení ${p.m2PerPack} m² vč. DPH (${p.pricePerM2} Kč/m²).`,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      inventoryLevel: inStock ? { "@type": "QuantitativeValue", value: Math.floor(p.stockM2), unitCode: "MTK", unitText: "m²" } : undefined,
      deliveryLeadTime: inStock ? { "@type": "QuantitativeValue", value: p.deliveryDays, unitText: "pracovních dnů" } : undefined,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", "@id": ldId("organization"), name: SITE_NAME, url: SITE_URL },
    },
  });
}

/** Drobečková navigace: stejné položky jako viditelný `<nav>`; `path` je cesta webu, ne absolutní URL. */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absUrl(it.path) })),
  };
}

/** Katalog nebo landing page jako kolekce produktů. Seznam odpovídá kanonické (nefiltrované) podobě stránky. */
export function collectionLd(c: { name: string; description?: string; path: string; products: Pick<PublicProduct, "slug" | "brand" | "name">[] }) {
  const url = absUrl(c.path);
  const shown = c.products.slice(0, 100);
  return compact({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    name: c.name,
    description: c.description,
    url,
    inLanguage: "cs-CZ",
    isPartOf: { "@id": ldId("website") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: c.products.length,
      itemListElement: shown.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: absUrl(`/podlaha/${p.slug}`), name: `${p.brand} ${p.name}` })),
    },
  });
}
