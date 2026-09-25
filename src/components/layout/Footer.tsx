import Link from "next/link";
import { Logo } from "./Logo";
import { LANDINGS } from "@/lib/catalog";
import type { SiteContent } from "@/lib/types";

export function Footer({ content }: { content: SiteContent }) {
  return (
    <footer className="bg-ink text-white/80 mt-auto">
      <div className="container py-14 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo light />
          <p className="mt-4 text-sm leading-relaxed text-white/60">{content.footerNote}</p>
        </div>
        <div>
          <p className="eyebrow text-white/50 mb-4">Podlahy</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/podlahy" className="hover:text-white">Všechny podlahy</Link></li>
            {LANDINGS.map((l) => (<li key={l.slug}><Link href={`/${l.slug}`} className="hover:text-white">{l.navLabel}</Link></li>))}
            <li><Link href="/prislusenstvi" className="hover:text-white">Příslušenství</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-white/50 mb-4">Nástroje</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/kalkulacka" className="hover:text-white">Kalkulačka projektu</Link></li>
            <li><Link href="/podlahy" className="hover:text-white">Katalog podlah</Link></li>
            <li><Link href="/vzorky" className="hover:text-white">Vzorky zdarma</Link></li>
            <li><Link href="/montaz" className="hover:text-white">Poptat pokládku</Link></li>
            <li><Link href="/doprava" className="hover:text-white">Doprava a platba</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-white/50 mb-4">Kontakt</p>
          <ul className="space-y-2 text-sm">
            <li><a href={`mailto:${content.contact.email}`} className="hover:text-white">{content.contact.email}</a></li>
            <li><a href={`tel:${content.contact.phone.replace(/\s/g, "")}`} className="hover:text-white">{content.contact.phone}</a></li>
            <li className="text-white/60">{content.contact.hours}</li>
            <li className="text-white/60 pt-2">{content.contact.company}<br />{content.contact.address}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container py-5 flex flex-col md:flex-row gap-2 md:items-center justify-between text-xs text-white/50">
          <span>© {new Date().getFullYear()} vinylpodlahy.cz</span>
          <span>Fotografie interiérů jsou ilustrační (demo dataset). <Link href="/admin" className="hover:text-white">Administrace</Link></span>
        </div>
      </div>
    </footer>
  );
}
