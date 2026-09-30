"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CalcResult, CartItem } from "@/lib/types";
import { useCart } from "@/store/cart";
import { fmtCzk } from "@/lib/format";
import { Check, Share } from "@/components/ui/icons";

export function SavedCalcActions({ calcId, result, disabled }: { calcId: string; result: CalcResult; disabled: boolean }) {
  const addMany = useCart((s) => s.addMany);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const toCart = () => { const items: CartItem[] = result.lines.filter((l) => !l.skipped && l.qty > 0).map((l) => ({ kind: l.kind, id: l.refId, qty: l.qty })); addMany(items, calcId); router.push("/kosik"); };
  // Na telefonu nativní sdílení (WhatsApp, e-mail…), jinak zkopírovat odkaz.
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: "Kalkulace podlahy", url }); } catch { /* zrušeno */ } return; }
    await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <>
      <div className="grid gap-2">
        <button type="button" className="btn btn-accent btn-lg w-full" disabled={disabled} onClick={toCart}>Vložit celý projekt do košíku</button>
        <button type="button" className="btn btn-outline w-full" onClick={share}>{copied ? <Check className="h-4 w-4" /> : <Share className="h-4 w-4" />} {copied ? "Odkaz zkopírován" : "Sdílet kalkulaci"}</button>
      </div>
      {!disabled && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-bg/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
          <div className="container py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0 leading-tight"><p className="text-lg tabular-nums">{fmtCzk(result.total)}</p><p className="text-xs text-muted">celý projekt bez dopravy</p></div>
            <button type="button" className="btn btn-accent shrink-0" onClick={toCart}>Do košíku</button>
          </div>
        </div>
      )}
    </>
  );
}
