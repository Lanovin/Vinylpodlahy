"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PublicProduct } from "@/lib/public";
import { useCart, useHydrated } from "@/store/cart";
import { FLOOR_TYPE_LABEL } from "@/lib/types";
import { Trash } from "@/components/ui/icons";

export function SamplesForm({ products, min, max }: { products: PublicProduct[]; min: number; max: number }) {
  const hydrated = useHydrated();
  const samples = useCart((s) => s.samples);
  const removeSample = useCart((s) => s.removeSample);
  const clearSamples = useCart((s) => s.clearSamples);
  const calculationId = useCart((s) => s.calculationId);
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", street: "", city: "", zip: "", consent: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = samples.map((id) => products.find((p) => p.id === id)).filter(Boolean) as PublicProduct[];

  if (!hydrated) return <div className="panel text-muted">Načítám…</div>;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (chosen.length < min) return setErr(`Vyberte alespoň ${min} vzorek.`);
    if (!form.consent) return setErr("Potvrďte prosím souhlas se zpracováním údajů.");
    setBusy(true);
    const res = await fetch("/api/samples", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, productIds: chosen.map((p) => p.id), calculationId }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setErr(d.error ?? "Odeslání se nepodařilo, zkuste to prosím znovu."); }
    const d = (await res.json()) as { id: string };
    clearSamples();
    router.push(`/vzorky/odeslano?id=${d.id}`);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-8 lg:gap-12">
      <div className="lg:col-span-6">
        <div className="flex items-baseline justify-between"><h2 className="h3">Vybrané vzorky <span className="text-muted text-base">{chosen.length}/{max}</span></h2>{chosen.length > 0 && <button type="button" className="text-sm text-muted hover:text-ink" onClick={clearSamples}>Vyprázdnit</button>}</div>
        {chosen.length === 0 ? (
          <div className="panel mt-4 text-center py-12"><p className="text-muted">Zatím žádný vzorek. Na kartě každé podlahy najdete tlačítko „Objednat vzorek zdarma“.</p><div className="mt-5 flex justify-center gap-3"><Link href="/podlahy" className="btn btn-primary">Vybrat v katalogu</Link><Link href="/kalkulacka" className="btn btn-outline">Nechat si poradit</Link></div></div>
        ) : (
          <ul className="mt-4 divide-y divide-line card">
            {chosen.map((p) => (
              <li key={p.id} className="flex items-center gap-4 p-3">
                <div className="relative h-16 w-20 rounded-sm overflow-hidden bg-bg shrink-0">{p.images.swatch && <Image src={p.images.swatch} alt="" fill sizes="80px" className="object-cover" />}</div>
                <div className="flex-1 min-w-0"><p className="eyebrow">{p.brand} · {p.collection}</p><p className="leading-tight"><Link href={`/podlaha/${p.slug}`} className="hover:underline">{p.decor}</Link></p><p className="text-xs text-muted">{FLOOR_TYPE_LABEL[p.type]}</p></div>
                <button type="button" className="p-2 text-muted hover:text-danger" aria-label="Odebrat" onClick={() => removeSample(p.id)}><Trash className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {chosen.length > 0 && chosen.length < max && <p className="text-sm text-muted mt-3">Můžete přidat ještě {max - chosen.length} {max - chosen.length === 1 ? "vzorek" : "vzorky"} — <Link href="/podlahy" className="link">zpět do katalogu</Link>.</p>}
        <div className="notice notice-info text-sm mt-6">Vzorky (cca 10 × 15 cm) posíláme zdarma obyčejnou poštou do 3–5 pracovních dní. Vzorkovnice je oddělená od hlavního košíku — nic neplatíte a nic vás k ničemu nezavazuje.</div>
      </div>
      <form onSubmit={submit} className="lg:col-span-6 panel space-y-4">
        <h2 className="h3">Kam vzorky pošleme</h2>
        <div><label className="label" htmlFor="s-name">Jméno a příjmení</label><input id="s-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="s-email">E-mail</label><input id="s-email" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></div>
          <div><label className="label" htmlFor="s-phone">Telefon (nepovinné)</label><input id="s-phone" type="tel" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></div>
        </div>
        <div><label className="label" htmlFor="s-street">Ulice a č. p.</label><input id="s-street" className="input" required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} autoComplete="street-address" /></div>
        <div className="grid grid-cols-[1fr_120px] gap-4">
          <div><label className="label" htmlFor="s-city">Město</label><input id="s-city" className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" /></div>
          <div><label className="label" htmlFor="s-zip">PSČ</label><input id="s-zip" className="input" required inputMode="numeric" pattern="[0-9 ]{5,6}" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} autoComplete="postal-code" /></div>
        </div>
        <label className="check text-sm items-start"><input type="checkbox" className="mt-1" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} /><span>Souhlasím se zpracováním údajů pro zaslání vzorků a navazující e-maily s radami k výběru (kdykoliv se lze odhlásit).</span></label>
        {err && <p className="notice notice-danger text-sm">{err}</p>}
        <button className="btn btn-accent btn-lg w-full" disabled={busy || chosen.length === 0}>{busy ? "Odesílám…" : `Poslat ${chosen.length || ""} ${chosen.length === 1 ? "vzorek" : chosen.length < 5 && chosen.length > 0 ? "vzorky" : "vzorků"} zdarma`}</button>
        {calculationId && <p className="text-xs text-muted">K žádosti přiložíme i vaši uloženou kalkulaci, abyste ji měli po ruce.</p>}
      </form>
    </div>
  );
}
