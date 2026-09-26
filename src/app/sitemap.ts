import type { MetadataRoute } from "next";
import { products } from "@/lib/db/repos";
import { LANDINGS } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinylpodlahy.cz";
  const statics = ["", "/podlahy", "/prislusenstvi", "/kalkulacka", "/vizualizace", "/vzorky", "/montaz", "/doprava", "/kontakt"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 }));
  const landings = LANDINGS.map((l) => ({ url: `${base}/${l.slug}`, changeFrequency: "weekly" as const, priority: 0.8 }));
  const prods = products.visible().map((p) => ({ url: `${base}/podlaha/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "daily" as const, priority: 0.6 }));
  return [...statics, ...landings, ...prods];
}
