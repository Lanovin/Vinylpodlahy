import Link from "next/link";
import { Logo } from "./Logo";
import { CookieSettingsButton } from "./CookieBanner";
import { LANDINGS } from "@/lib/catalog";
import { LEGAL_PAGES } from "@/components/legal/pages";
import type { SiteContent } from "@/lib/types";

/** Odkazy v patičce: na telefonu 44 px vysoké (dotyková plocha), na desktopu hustší. */
const LINK = "flex items-center min-h-11 md:min-h-0 md:py-1 hover:text-white";
const HEAD = "eyebrow !text-white/50 mb-1 md:mb-3";

export function Footer({ content }: { content: SiteContent }) {
  const c = content.contact;
  return (
    <footer className="bg-ink text-white/80 mt-auto">
      {/* Telefon 2 sloupce, tablet 4 (logo nad nimi přes celou šířku), desktop logo + 4 sloupce vedle sebe. */}
      <div className="container py-10 md:py-14 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] md:gap-x-8 lg:gap-x-10">
        <div className="col-span-2 md:col-span-4 lg:col-span-1 min-w-0">
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-white/60 max-w-md">{content.footerNote}</p>
        </div>
        <div className="min-w-0">
          <p className={HEAD}>Podlahy</p>
          <ul className="text-sm">
            <li><Link href="/podlahy" className={LINK}>Všechny podlahy</Link></li>
            {LANDINGS.map((l) => (<li key={l.slug}><Link href={`/${l.slug}`} className={LINK}>{l.navLabel}</Link></li>))}
            <li><Link href="/prislusenstvi" className={LINK}>Příslušenství</Link></li>
          </ul>
        </div>
        <div className="min-w-0">
          <p className={HEAD}>Nákup</p>
          <ul className="text-sm">
            <li><Link href="/kalkulacka" className={LINK}>Kalkulačka</Link></li>
            <li><Link href="/vizualizace" className={LINK}>Byt ve 3D</Link></li>
            <li><Link href="/vzorky" className={LINK}>Vzorky zdarma</Link></li>
            <li><Link href="/montaz" className={LINK}>Pokládka</Link></li>
            <li><Link href="/doprava" className={LINK}>Doprava a platba</Link></li>
            <li><Link href="/kosik" className={LINK}>Košík</Link></li>
          </ul>
        </div>
        <div className="min-w-0">
          <p className={HEAD}>Informace</p>
          <ul className="text-sm">
            {LEGAL_PAGES.map((p) => (<li key={p.href}><Link href={p.href} className={LINK}>{p.label}</Link></li>))}
            <li><CookieSettingsButton className="flex items-center min-h-11 text-left hover:text-white" /></li>
          </ul>
        </div>
        <div className="min-w-0">
          <p className={HEAD}>Kontakt</p>
          <ul className="text-sm">
            <li><a href={`mailto:${c.email}`} className={`${LINK} break-all`}>{c.email}</a></li>
            <li><a href={`tel:${c.phone.replace(/\s/g, "")}`} className={LINK}>{c.phone}</a></li>
            <li className="text-white/60 py-1">{c.hours}</li>
            <li><Link href="/kontakt" className={LINK}>Kontaktní stránka</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        {/* Spodní odsazení: na telefonu místo pro spodní lištu, a dokud je otevřená lišta cookies, i pro ni. */}
        <div className="container pt-5 pb-[calc(6rem+var(--cookie-h,0px))] lg:pb-[calc(1.25rem+var(--cookie-h,0px))] flex flex-col lg:flex-row gap-1 lg:gap-6 lg:items-center justify-between text-xs text-white/50">
          <p>© {new Date().getFullYear()} vinylpodlahy.cz</p>
          <p className="leading-relaxed">Provozovatel: {c.company} · IČO {c.ico}{c.dic ? ` · DIČ ${c.dic}` : ""} · sídlo {c.address}</p>
        </div>
      </div>
    </footer>
  );
}
