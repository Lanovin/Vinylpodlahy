import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import "./globals.css";
import { Gtm } from "@/components/layout/Gtm";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const jost = Jost({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500"], variable: "--font-jost", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "vinylpodlahy.cz — Vinylové a SPC podlahy s kalkulačkou projektu", template: "%s | vinylpodlahy.cz" },
  description: "Vinylové a SPC podlahy. Přijďte s místností, odejděte s kompletním košíkem: balení, podložka, lišty i doprava spočítané na vaše metry.",
  // Výchozí náhled při sdílení a pro AI; stránky s vlastním obrázkem (karta produktu) ho přepíšou.
  openGraph: { type: "website", locale: "cs_CZ", siteName: SITE_NAME, images: [{ url: "/media/inspiration/hero.webp", width: 2000, height: 1125, alt: "Vinylová podlaha v interiéru" }] },
  twitter: { card: "summary_large_image", images: ["/media/inspiration/hero.webp"] },
};

export const viewport: Viewport = { themeColor: "#17150f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" data-scroll-behavior="smooth" className={`${jost.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <CookieBanner />
        <Gtm />
      </body>
    </html>
  );
}
