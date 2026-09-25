"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const ITEMS = [
  { href: "/admin", label: "Přehled", key: "alerts" },
  { href: "/admin/objednavky", label: "Objednávky", key: "orders" },
  { href: "/admin/poptavky", label: "Poptávky montáže", key: "leads" },
  { href: "/admin/vzorky", label: "Vzorky a e-maily", key: "samples" },
  { href: "/admin/kalkulace", label: "Kalkulace" },
  { href: "/admin/produkty", label: "Produkty" },
  { href: "/admin/cenotvorba", label: "Cenotvorba" },
  { href: "/admin/feedy", label: "Feedy a dodavatelé" },
  { href: "/admin/obsah", label: "Texty webu" },
  { href: "/admin/nastaveni", label: "Nastavení" },
] as const;

export function AdminNav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
      {ITEMS.map((it) => {
        const active = it.href === "/admin" ? path === "/admin" : path.startsWith(it.href);
        const badge = "key" in it ? counts[it.key] : 0;
        return (
          <Link key={it.href} href={it.href} className={clsx("flex items-center justify-between gap-3 px-3 py-2 rounded text-sm whitespace-nowrap", active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white")}>
            {it.label}{badge ? <span className="text-[10px] bg-accent text-white rounded-full px-1.5 py-0.5 leading-none">{badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
