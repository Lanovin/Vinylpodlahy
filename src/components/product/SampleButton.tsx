"use client";
import clsx from "clsx";
import { useState } from "react";
import { useCart, useHydrated } from "@/store/cart";
import { Check, Swatch } from "@/components/ui/icons";

export function SampleButton({ productId, max, size = "md", className, compact = false }: { productId: string; max: number; size?: "sm" | "md" | "lg"; className?: string; /** Kratší popisek pro úzké karty (2 sloupce na mobilu). */ compact?: boolean }) {
  const hydrated = useHydrated();
  const samples = useCart((s) => s.samples);
  const toggle = useCart((s) => s.toggleSample);
  const [msg, setMsg] = useState<string | null>(null);
  const active = hydrated && samples.includes(productId);

  return (
    <div className={clsx("inline-flex flex-col", className)}>
      <button
        type="button"
        className={clsx("btn", size === "sm" && "btn-sm", size === "lg" && "btn-lg", active ? "btn-primary" : "btn-outline")}
        onClick={() => {
          const r = toggle(productId, max);
          setMsg(r === "full" ? `Maximálně ${max} vzorků na jednu objednávku.` : null);
          if (r !== "full") setTimeout(() => setMsg(null), 100);
        }}
        aria-pressed={active}
      >
        {active ? <Check className="h-4 w-4" /> : <Swatch className="h-4 w-4" />}
        {active ? "Vzorek vybrán" : compact ? "Vzorek zdarma" : "Objednat vzorek zdarma"}
      </button>
      {msg && <span className="text-xs text-warn mt-1">{msg}</span>}
    </div>
  );
}
