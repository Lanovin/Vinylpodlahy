"use client";
import { useState } from "react";
import { useCart } from "@/store/cart";

export function AddAccessoryButton({ id, className = "btn btn-outline btn-sm" }: { id: string; className?: string }) {
  const add = useCart((s) => s.add);
  const [ok, setOk] = useState(false);
  return <button type="button" className={className} onClick={() => { add({ kind: "accessory", id, qty: 1 }); setOk(true); setTimeout(() => setOk(false), 1800); }}>{ok ? "Přidáno ✓" : "Do košíku"}</button>;
}
