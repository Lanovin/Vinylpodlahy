import Link from "next/link";
import { Logo } from "./Logo";
import { CookieSettingsButton } from "./CookieBanner";
import { LANDINGS } from "@/lib/catalog";
import type { SiteContent } from "@/lib/types";

/** Odkazy v patičce: na telefonu 40 px vysoké, na desktopu hustší. */
const LINK = "block py-2.5 md:py-1 hover:text-white";

export function Footer({ content }: { content: SiteContent }) {
  return (
    <footer className="bg-ink text-white/80 mt-auto">
      <div className="container py-10 md:py-14 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 md:gap-10">
        <div className="col-span-2 md:col-span-1">
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-white/60">{content.footerNote}</p>
        </div>
        <div>
          <p className="eyebrow !text-white/50 mb-2 md:mb-3">Podlahy</p>
          <ul className="text-sm">
            <li><Link href="/podlahy" className={LINK}>Všechny podlahy</Link></li>
            {LANDINGS.map((l) => (<li key={l.slug}><Link href={`/${l.slug}`} className={LINK}>{l.navLabel}</Link></li>))}
            <li><Link href="/prislusenstvi" className={LINK}>Příslušenství</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow !text-white/50 mb-2 md:mb-3">Nástroje</p>
          <ul className="text-sm">
            <li><Link href="/kalkulacka" className={LINK}>Kalkulačka projektu</Link></li>
            <li><Link href="/vizualizace" className={LINK}>3D vizualizace</Link></li>
            <li><Link href="/vzorky" className={LINK}>Vzorky zdarma</Link></li>
            <li><Link href="/montaz" className={LINK}>Poptat pokládku</Link></li>
            <li><Link href="/doprava" className={LINK}>Doprava a platba</Link></li>
          </ul>
        </div>
        <div className="col-span-2 md:col-span-1">
          <p className="eyebrow !text-white/50 mb-2 md:mb-3">Kontakt</p>
          <ul className="text-sm">
            <li><a href={`mailto:${content.contact.email}`} className={LINK}>{content.contact.email}</a></li>
            <li><a href={`tel:${content.contact.phone.replace(/\s/g, "")}`} className={LINK}>{content.contact.phone}</a></li>
            <li className="text-white/60 py-1">{content.contact.hours}</li>
            <li className="text-white/60 pt-2">{content.contact.company}<br />{content.contact.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container pt-5 pb-24 lg:pb-5 flex flex-col md:flex-row gap-2 md:items-center justify-between text-xs text-white/50">
          <span>© {new Date().getFullYear()} vinylpodlahy.cz · <CookieSettingsButton className="hover:text-white underline underline-offset-2" /></span>
          <span>Fotografie interiérů jsou ilustrační (demo dataset). <Link href="/admin" className="hover:text-white">Administrace</Link></span>
        </div>
      </div>
    </footer>
  );
}
