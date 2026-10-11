"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Menu, Search, ShoppingBag, X, Cube, Ruler } from "@/components/ui/icons";
import { Logo } from "./Logo";
import { useCart, useHydrated } from "@/store/cart";

/** Menu je záměrně krátké: hlavní je „Podlaha na klíč“ (kalkulačka). Doprava, pokládka a typy podlah jsou v patičce a v kalkulačce. */
const NAV: { href: string; label: string }[] = [
  { href: "/kalkulacka", label: "Podlaha na klíč" },
  { href: "/vizualizace", label: "Byt ve 3D" },
  { href: "/podlahy", label: "Podlahy" },
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
  const cartCount = hydrated ? items.length : 0; // počet položek, ne balení (24 balení podlahy = 1 položka)

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
  // Odkaz na právě otevřenou stránku cestu nezmění — menu proto zavírá i samotný klik.
  const close = () => setOpen(false);

  return (
    <>
    <header className={clsx("z-50 top-0 left-0 right-0 transition-colors duration-300", overlay ? "fixed" : "sticky", light ? "text-white" : "text-ink bg-bg/95 backdrop-blur border-b border-line")}>
      <div className="container flex items-center justify-between h-16 md:h-20">
        <Logo light={light} />
        <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-[0.95rem]">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={clsx("py-6 hover:opacity-70 whitespace-nowrap", pathname === n.href && "underline underline-offset-8")}>{n.label}</Link>
          ))}
        </nav>
        {/* Na telefonu jen hledání, košík a menu (44 px na palec) */}
        <div className="flex items-center -mr-2 sm:mr-0 md:gap-1">
          <button className="h-11 w-10 sm:w-11 grid place-items-center hover:opacity-70" aria-label="Hledat" aria-expanded={searchOpen} onClick={() => setSearchOpen((v) => !v)}><Search className="h-5 w-5" /></button>
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
            {/* Hlavní nástroje jako první: Podlaha na klíč a 3D byt jsou hlavní cesta k nákupu */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Link href="/kalkulacka" onClick={close} className="rounded-md bg-accent text-white p-3.5 flex flex-col gap-2"><Ruler className="h-6 w-6" /><span className="leading-tight">Podlaha na klíč<span className="block text-xs text-white/80 mt-0.5">cena za 2 minuty</span></span></Link>
              <Link href="/vizualizace" onClick={close} className="rounded-md bg-ink text-white p-3.5 flex flex-col gap-2"><Cube className="h-6 w-6" /><span className="leading-tight">Byt ve 3D<span className="block text-xs text-white/70 mt-0.5">vyzkoušejte dekor</span></span></Link>
            </div>
            {NAV.filter((n) => n.href !== "/kalkulacka" && n.href !== "/vizualizace").map((n) => (
              <Link key={n.href} href={n.href} onClick={close} className="flex items-center justify-between py-3 border-b border-line">{n.label}</Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}
