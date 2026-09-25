"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CalcResult, CartItem } from "@/lib/types";
import { useCart } from "@/store/cart";
import { Check, Copy } from "@/components/ui/icons";

export function SavedCalcActions({ calcId, result, disabled }: { calcId: string; result: CalcResult; disabled: boolean }) {
  const addMany = useCart((s) => s.addMany);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2">
      <button type="button" className="btn btn-accent btn-lg w-full" disabled={disabled} onClick={() => { const items: CartItem[] = result.lines.filter((l) => !l.skipped && l.qty > 0).map((l) => ({ kind: l.kind, id: l.refId, qty: l.qty })); addMany(items, calcId); router.push("/kosik"); }}>Vložit celý projekt do košíku</button>
      <button type="button" className="btn btn-outline w-full" onClick={async () => { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Odkaz zkopírován" : "Kopírovat odkaz"}</button>
    </div>
  );
}
