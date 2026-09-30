"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Menu, Search, ShoppingBag, Swatch, X, ChevronDown, Cube, Ruler } from "@/components/ui/icons";
import { Logo } from "./Logo";
import { useCart, useHydrated } from "@/store/cart";
import { LANDINGS } from "@/lib/catalog";

const NAV = [
  { href: "/kalkulacka", label: "Kalkulačka" },
  { href: "/vizualizace", label: "Vizualizace" },
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
  const cartCount = hydrated ? items.length : 0; // počet položek, ne balení (24 balení podlahy = 1 položka)
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

  const light = overlay && !scrolled && !open && !searchOpen;

  return (
    <>
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
        {/* Na telefonu jen hledání, košík a menu (44 px na palec); vzorky jsou v menu a na kartách */}
        <div className="flex items-center -mr-2 sm:mr-0 md:gap-1">
          <button className="h-11 w-10 sm:w-11 grid place-items-center hover:opacity-70" aria-label="Hledat" aria-expanded={searchOpen} onClick={() => setSearchOpen((v) => !v)}><Search className="h-5 w-5" /></button>
          <Link href="/vzorky" className="relative h-11 w-11 hidden sm:grid place-items-center hover:opacity-70" aria-label="Vzorky zdarma">
            <Swatch className="h-5 w-5" />
            {sampleCount > 0 && <span className="absolute top-1 right-0.5 h-4 min-w-4 px-1 rounded-full bg-sage text-white text-[10px] leading-4 text-center">{sampleCount}</span>}
          </Link>
          <Link href="/kosik" className="relative h-11 w-10 sm:w-11 grid place-items-center hover:opacity-70" aria-label="Košík">
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute top-1 right-0 h-4 min-w-4 px-1 rounded-full bg-accent text-white text-[10px] leading-4 text-center">{cartCount}</span>}
          </Link>
          <button className="h-11 w-11 grid place-items-center lg:hidden hover:opacity-70" aria-label="Menu" onClick={() => setOpen(true)}><Menu className="h-6 w-6" /></button>
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-line bg-bg text-ink">
          <form className="container py-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); router.push(`/podlahy?q=${encodeURIComponent(q)}`); setSearchOpen(false); }}>
            <input autoFocus type="search" enterKeyHint="search" className="input" placeholder="Dekor, kolekce, značka…" aria-label="Hledat podlahu" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-primary">Hledat</button>
          </form>
        </div>
      )}

    </header>

      {/* Mobilní menu — mimo <header>: jeho backdrop-blur by pro fixed prvky vytvořil vlastní kontejner
          (menu by bylo jen v pruhu hlavičky a vysunutý panel by rozšířil stránku na mobilu). */}
      <div className={clsx("fixed inset-0 z-[60] lg:hidden transition", open ? "visible" : "invisible")}>
        <div className={clsx("absolute inset-0 bg-ink/40 transition-opacity", open ? "opacity-100" : "opacity-0")} onClick={() => setOpen(false)} />
        <div className={clsx("absolute top-0 right-0 h-full w-[88%] max-w-sm bg-bg text-ink shadow-2xl transition-transform duration-300 flex flex-col", open ? "translate-x-0" : "translate-x-full")}>
          <div className="flex items-center justify-between h-16 px-4 border-b border-line">
            <span className="eyebrow">Menu</span>
            <button className="p-2" aria-label="Zavřít" onClick={() => setOpen(false)}><X className="h-6 w-6" /></button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-4 text-lg">
            {/* Hlavní nástroje jako první — kalkulačka a 3D byt jsou hlavní cesta k nákupu */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Link href="/kalkulacka" className="rounded-md bg-accent text-white p-3.5 flex flex-col gap-2"><Ruler className="h-6 w-6" /><span className="leading-tight">Spočítat cenu<span className="block text-xs text-white/80 mt-0.5">za 2 minuty</span></span></Link>
              <Link href="/vizualizace" className="rounded-md bg-ink text-white p-3.5 flex flex-col gap-2"><Cube className="h-6 w-6" /><span className="leading-tight">Byt ve 3D<span className="block text-xs text-white/70 mt-0.5">vyzkoušejte dekor</span></span></Link>
            </div>
            <Link href="/podlahy" className="block py-3 border-b border-line">Všechny podlahy</Link>
            {LANDINGS.map((l) => (<Link key={l.slug} href={`/${l.slug}`} className="block py-2.5 pl-4 text-base text-ink-soft">{l.navLabel}</Link>))}
            <Link href="/prislusenstvi" className="block py-2.5 pl-4 text-base text-ink-soft border-b border-line">Příslušenství</Link>
            {NAV.filter((n) => n.href !== "/kalkulacka" && n.href !== "/vizualizace").map((n) => (
              <Link key={n.href} href={n.href} className="flex items-center justify-between py-3 border-b border-line">{n.label}{n.href === "/vzorky" && sampleCount > 0 && <span className="h-5 min-w-5 px-1.5 rounded-full bg-sage text-white text-xs leading-5 text-center">{sampleCount}</span>}</Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
