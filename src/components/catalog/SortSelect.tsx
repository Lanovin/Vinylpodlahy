"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ value }: { value: string }) {
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-muted">Řadit
      <select className="select !w-auto !py-1.5 text-ink" value={value} onChange={(e) => { const p = new URLSearchParams(sp.toString()); if (e.target.value === "price-asc") p.delete("sort"); else p.set("sort", e.target.value); router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false }); }}>
        <option value="price-asc">cena / m² — od nejnižší</option>
        <option value="price-desc">cena / m² — od nejvyšší</option>
        <option value="stock">dostupnost</option>
        <option value="new">novinky</option>
      </select>
    </label>
  );
}
