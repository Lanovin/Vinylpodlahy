import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinylpodlahy.cz";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/kosik", "/pokladna", "/objednavka", "/kalkulace"] }], sitemap: `${base}/sitemap.xml` };
}
