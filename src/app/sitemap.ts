import type { MetadataRoute } from "next";
import { accessories, products } from "@/lib/db/repos";
import { LANDINGS } from "@/lib/catalog";
import { LEGAL_PAGES } from "@/components/legal/pages";
import { SITE_URL as base } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Nejnovější změna v seznamu; bez záznamů `undefined`, ať se `lastmod` raději neuvede, než aby se vymýšlelo datum. */
const latest = (dates: string[]) => dates.reduce<string | undefined>((a, d) => (!a || d > a ? d : a), undefined);

export default function sitemap(): MetadataRoute.Sitemap {
  const visible = products.visible();
  // Katalog, landing pages a úvodní stránka se mění s produkty (ceny, dostupnost, nové dekory).
  const catalogMod = latest(visible.map((p) => p.updatedAt));
  const accessoriesMod = latest(accessories.visible().map((a) => a.updatedAt));
  const lastmod: Record<string, string | undefined> = { "": catalogMod, "/podlahy": catalogMod, "/prislusenstvi": accessoriesMod };
  // Doprava, kalkulačka, kontakt a právní stránky nemají datum změny — `lastmod` se u nich neuvádí.
  const statics = ["", "/podlahy", "/prislusenstvi", "/kalkulacka", "/vizualizace", "/montaz", "/doprava", "/kontakt"].map((p) => ({ url: `${base}${p}`, lastModified: lastmod[p], changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  const legal = LEGAL_PAGES.map((l) => ({ url: `${base}${l.href}`, changeFrequency: "yearly" as const, priority: 0.2 }));
  const landings = LANDINGS.map((l) => ({ url: `${base}/${l.slug}`, lastModified: catalogMod, changeFrequency: "weekly" as const, priority: 0.8 }));
  const prods = visible.map((p) => ({ url: `${base}/podlaha/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.6 }));
  return [...statics, ...landings, ...prods, ...legal];
}
