"use client";
import { useEffect, useState } from "react";
import type { CartQuote } from "@/lib/types";
import { useCart, useHydrated } from "@/store/cart";

/** Ocenění košíku vždy ze serveru (ceny, hmotnosti, rozdělení zásilek). */
export function useQuote() {
  const hydrated = useHydrated();
  const items = useCart((s) => s.items);
  const carryUp = useCart((s) => s.carryUp);
  const [state, setState] = useState<{ key: string; quote: CartQuote } | null>(null);
  const key = JSON.stringify({ items, carryUp });
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const ctrl = new AbortController();
    fetch("/api/cart/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, carryUp }), signal: ctrl.signal })
      .then((r) => r.json()).then((q: CartQuote) => setState({ key, quote: q })).catch(() => {});
    return () => ctrl.abort();
  }, [hydrated, items, carryUp, key]);
  const empty = hydrated && items.length === 0;
  const quote = empty ? null : state?.quote ?? null;
  const loading = !hydrated || (!empty && state?.key !== key);
  return { quote, loading, hydrated, items };
}
