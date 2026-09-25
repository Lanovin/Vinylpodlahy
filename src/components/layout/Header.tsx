"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Menu, Search, ShoppingBag, Swatch, X, ChevronDown } from "@/components/ui/icons";
import { Logo } from "./Logo";
import { useCart, useHydrated } from "@/store/cart";
import { LANDINGS } from "@/lib/catalog";

const NAV = [
  { href: "/kalkulacka", label: "Kalkulačka" },
  { href: "/vzorky", label: "Vzorky zdarma" },
  { href: "/montaz", label: "Pokládka" },
  { href: "/kontakt", label: "Kontakt" },
];

export function Header({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const samples = useCart((s) => s.samples);
  const cartCount = hydrated ? items.reduce((n, i) => n + i.qty, 0) : 0;
  const sampleCount = hydrated ? samples.length : 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Zavřít menu při změně cesty — odvozený stav nastavovaný během renderu (bez efektu).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) { setSeenPath(pathname); setOpen(false); setSearchOpen(false); }
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);

  const light = overlay && !scrolled && !open;

  return (
    <header className={clsx("z-50 top-0 left-0 right-0 transition-colors duration-300", overlay ? "fixed" : "sticky", light ? "text-white" : "text-ink bg-bg/95 backdrop-blur border-b border-line")}>
      <div className="container flex items-center justify-between h-16 md:h-20">
        <Logo light={light} />
        <nav className="hidden lg:flex items-center gap-7 text-[0.95rem]">
          <div className="relative group">
            <Link href="/podlahy" className="inline-flex items-center gap-1 py-6 hover:opacity-70">Podlahy <ChevronDown className="h-4 w-4" /></Link>
            <div className="absolute left-1/2 -translate-x-1/2 top-full pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="card shadow-card p-2 min-w-[260px] text-ink">
                <Link href="/podlahy" className="block px-3 py-2 rounded hover:bg-bg">Všechny podlahy</Link>
                <div className="divider my-1" />
                {LANDINGS.map((l) => (
                  <Link key={l.slug} href={`/${l.slug}`} className="block px-3 py-2 rounded hover:bg-bg">{l.navLabel}</Link>
                ))}
                <div className="divider my-1" />
                <Link href="/prislusenstvi" className="block px-3 py-2 rounded hover:bg-bg">Příslušenství</Link>
              </div>
            </div>
          </div>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={clsx("py-6 hover:opacity-70", pathname === n.href && "underline underline-offset-8")}>{n.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 md:gap-2">
          <button className="p-2 hover:opacity-70" aria-label="Hledat" onClick={() => setSearchOpen((v) => !v)}><Search className="h-5 w-5" /></button>
          <Link href="/vzorky" className="relative p-2 hover:opacity-70" aria-label="Vzorky zdarma">
            <Swatch className="h-5 w-5" />
            {sampleCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-sage text-white text-[10px] leading-4 text-center">{sampleCount}</span>}
          </Link>
          <Link href="/kosik" className="relative p-2 hover:opacity-70" aria-label="Košík">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-accent text-white text-[10px] leading-4 text-center">{cartCount}</span>}
          </Link>
          <button className="p-2 lg:hidden hover:opacity-70" aria-label="Menu" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-line bg-bg text-ink">
          <form className="container py-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); router.push(`/podlahy?q=${encodeURIComponent(q)}`); setSearchOpen(false); }}>
            <input autoFocus className="input" placeholder="Hledat dekor, kolekci, značku… (např. dub šedý)" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-primary">Hledat</button>
          </form>
        </div>
      )}

      {/* Mobilní menu */}
      <div className={clsx("fixed inset-0 z-[60] lg:hidden transition", open ? "visible" : "invisible")}>
        <div className={clsx("absolute inset-0 bg-ink/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <div className={clsx("absolute top-0 right-0 h-full w-[88%] max-w-sm bg-bg text-ink shadow-2xl transition-transform duration-300 flex flex-col", open ? "translate-x-0" : "translate-x-full")}>
          <div className="flex items-center justify-between h-16 px-4 border-b border-line">
            <span className="eyebrow">Menu</span>
            <button className="p-2" aria-label="Zavřít" onClick={() => setOpen(false)}><X className="h-6 w-6" /></button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-4 text-lg">
            <Link href="/podlahy" className="block py-3 border-b border-line">Všechny podlahy</Link>
            {LANDINGS.map((l) => (<Link key={l.slug} href={`/${l.slug}`} className="block py-2.5 pl-4 text-base text-ink-soft">{l.navLabel}</Link>))}
            <Link href="/prislusenstvi" className="block py-2.5 pl-4 text-base text-ink-soft border-b border-line">Příslušenství</Link>
            {NAV.map((n) => (<Link key={n.href} href={n.href} className="block py-3 border-b border-line">{n.label}</Link>))}
          </nav>
          <div className="p-4 grid grid-cols-2 gap-2 border-t border-line">
            <Link href="/kalkulacka" className="btn btn-primary">Spočítat projekt</Link>
            <Link href="/vzorky" className="btn btn-outline">Vzorky zdarma</Link>
          </div>
        </div>
      </div>
    </header>
  );
}
