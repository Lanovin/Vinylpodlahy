"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

interface CartState {
  items: CartItem[];
  /** Vzorky zdarma — oddělený košík (jiná doprava, jiný proces). */
  samples: string[];
  calculationId: string | null;
  carryUp: { enabled: boolean; floor: number; elevator: boolean };
  installRequested: boolean;
  add: (item: CartItem) => void;
  addMany: (items: CartItem[], calculationId?: string | null) => void;
  setQty: (kind: CartItem["kind"], id: string, qty: number) => void;
  remove: (kind: CartItem["kind"], id: string) => void;
  clear: () => void;
  toggleSample: (id: string, max: number) => "added" | "removed" | "full";
  removeSample: (id: string) => void;
  clearSamples: () => void;
  setCarryUp: (c: Partial<CartState["carryUp"]>) => void;
  setInstallRequested: (v: boolean) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      samples: [],
      calculationId: null,
      carryUp: { enabled: false, floor: 1, elevator: false },
      installRequested: false,
      add: (item) => set((s) => {
        const ex = s.items.find((i) => i.kind === item.kind && i.id === item.id);
        return ex
          ? { items: s.items.map((i) => (i === ex ? { ...i, qty: i.qty + item.qty } : i)) }
          : { items: [...s.items, item] };
      }),
      addMany: (items, calculationId = null) => set((s) => {
        const next = [...s.items];
        for (const it of items) {
          if (it.qty <= 0) continue;
          const idx = next.findIndex((i) => i.kind === it.kind && i.id === it.id);
          if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + it.qty };
          else next.push(it);
        }
        return { items: next, calculationId: calculationId ?? s.calculationId };
      }),
      setQty: (kind, id, qty) => set((s) => ({
        items: qty <= 0 ? s.items.filter((i) => !(i.kind === kind && i.id === id)) : s.items.map((i) => (i.kind === kind && i.id === id ? { ...i, qty } : i)),
      })),
      remove: (kind, id) => set((s) => ({ items: s.items.filter((i) => !(i.kind === kind && i.id === id)) })),
      clear: () => set({ items: [], calculationId: null, carryUp: { enabled: false, floor: 1, elevator: false }, installRequested: false }),
      toggleSample: (id, max) => {
        const s = get();
        if (s.samples.includes(id)) { set({ samples: s.samples.filter((x) => x !== id) }); return "removed"; }
        if (s.samples.length >= max) return "full";
        set({ samples: [...s.samples, id] });
        return "added";
      },
      removeSample: (id) => set((s) => ({ samples: s.samples.filter((x) => x !== id) })),
      clearSamples: () => set({ samples: [] }),
      setCarryUp: (c) => set((s) => ({ carryUp: { ...s.carryUp, ...c } })),
      setInstallRequested: (v) => set({ installRequested: v }),
    }),
    { name: "vinylpodlahy-cart" },
  ),
);

/** Zabrání hydration mismatch — persist store se načte až na klientu. */
import { useSyncExternalStore } from "react";
const noop = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
