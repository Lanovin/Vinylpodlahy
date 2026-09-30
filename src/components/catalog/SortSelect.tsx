"use client";
import clsx from "clsx";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const OPTIONS = [["price-asc", "Nejlevnější"], ["price-desc", "Nejdražší"], ["stock", "Nejvíc skladem"], ["new", "Novinky"]] as const;

export function SortSelect({ value, className }: { value: string; className?: string }) {
  const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();
  return (
    <select aria-label="Řadit podle" className={clsx("select py-0 text-ink", className)} value={value} onChange={(e) => { const p = new URLSearchParams(sp.toString()); if (e.target.value === "price-asc") p.delete("sort"); else p.set("sort", e.target.value); router.replace(`${pathname}${p.toString() ? `?${p}` : ""}`, { scroll: false }); }}>
      {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
