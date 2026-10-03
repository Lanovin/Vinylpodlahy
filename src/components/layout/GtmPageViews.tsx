"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Next přechází mezi stránkami bez načtení dokumentu, takže GTM bez toho vidí jen první stránku návštěvy.
 * Při každé další změně adresy pošle do dataLayeru událost `virtual_page_view` (v GTM na ni navažte trigger
 * typu Custom Event). První stránku měří standardní Page View trigger kontejneru, proto se tu přeskakuje.
 */
export function GtmPageViews() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (pathname.startsWith("/admin")) return;
    // Název stránky Next aktualizuje až po přechodu — chvíli počkáme, ať událost nenese starý title.
    const t = setTimeout(() => {
      window.dataLayer?.push({
        event: "virtual_page_view",
        page_location: window.location.href,
        page_path: pathname,
        page_title: document.title,
      });
    }, 100);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
