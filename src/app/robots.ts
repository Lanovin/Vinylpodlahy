import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** AI crawlery a vyhledávače — explicitně povolené (trénink, vyhledávání i načtení stránky na žádost uživatele). */
const AI_BOTS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-User", "Claude-SearchBot",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "CCBot",
];

/** Neveřejné cesty. Skupina konkrétního bota přebíjí `*`, proto se seznam musí opakovat v obou skupinách. */
const PRIVATE_PATHS = ["/admin", "/api", "/kosik", "/pokladna", "/objednavka", "/kalkulace"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_BOTS, allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
