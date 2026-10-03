"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Cube, Ruler } from "@/components/ui/icons";

/** Stránky s vlastní spodní lištou nebo tam, kde by odváděla od nákupu. Nad cookie lištou díky --cookie-h (CookieBanner). */
const HIDDEN = ["/kalkulacka", "/kalkulace", "/vizualizace", "/kosik", "/pokladna", "/objednavka", "/podlaha/", "/vzorky", "/montaz", "/admin"];

/**
 * Spodní lišta na telefonu: kalkulačka a 3D byt na jedno ťuknutí z jakékoli stránky.
 * Na úvodní stránce až pod hero (tam je formulář kalkulačky), při psaní do formuláře se schová.
 */
export function MobileDock() {
  const pathname = usePathname();
  const home = pathname === "/";
  const [pastHero, setPastHero] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!home) return;
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.75);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [home]);
  useEffect(() => {
    const field = (t: EventTarget | null) => t instanceof HTMLElement && t.matches("input:not([type=checkbox]):not([type=radio]), textarea, select");
    const onIn = (e: FocusEvent) => { if (field(e.target)) setTyping(true); };
    const onOut = (e: FocusEvent) => { if (field(e.target)) setTyping(false); };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => { document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); };
  }, []);

  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;
  const show = (!home || pastHero) && !typing;

  return (
    <div className={clsx("lg:hidden fixed inset-x-0 bottom-[var(--cookie-h,0px)] z-40 bg-bg/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)] transition-transform duration-300", show ? "translate-y-0" : "translate-y-[calc(100%+var(--cookie-h,0px))]")} aria-hidden={!show}>
      <div className="container py-2 grid grid-cols-[1.4fr_1fr] gap-2">
        <Link href="/kalkulacka" tabIndex={show ? undefined : -1} className="btn btn-accent"><Ruler className="h-4 w-4" /> Spočítat cenu</Link>
        <Link href="/vizualizace" tabIndex={show ? undefined : -1} className="btn btn-outline"><Cube className="h-4 w-4" /> Byt ve 3D</Link>
      </div>
    </div>
  );
}
