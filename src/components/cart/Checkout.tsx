"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/store/cart";
import { useQuote } from "./useQuote";
import { ShipmentsView } from "./ShipmentsView";
import { fmtCzk } from "@/lib/format";

export function Checkout() {
  const { quote, loading, hydrated } = useQuote();
  const router = useRouter();
  const { items, carryUp, installRequested, calculationId, clear } = useCart();
  const [form, setForm] = useState({ name: "", email: "", phone: "", street: "", city: "", zip: "", note: "", terms: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hydrated || (loading && !quote)) return <div className="panel text-muted">Načítám…</div>;
  if (!quote || quote.lines.length === 0) return <div className="panel text-center py-12"><p className="text-muted">Košík je prázdný.</p><Link href="/kalkulacka" className="btn btn-primary mt-4">Spočítat projekt</Link></div>;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!form.terms) return setErr("Potvrďte prosím obchodní podmínky.");
    setBusy(true);
    const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customer: form, items, carryUp, installRequested, calculationId }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setErr(d.error ?? "Objednávku se nepodařilo odeslat."); }
    const d = (await res.json()) as { id: string };
    clear();
    router.push(`/objednavka/${d.id}`);
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-8 lg:gap-12">
      <div className="lg:col-span-7 space-y-8 min-w-0">
        <section className="panel space-y-4">
          <h2 className="h3">Dodací údaje</h2>
          <div><label className="label" htmlFor="c-name">Jméno a příjmení / firma</label><input id="c-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label" htmlFor="c-email">E-mail</label><input id="c-email" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></div>
            <div><label className="label" htmlFor="c-phone">Telefon (řidič vám zavolá)</label><input id="c-phone" type="tel" className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></div>
          </div>
          <div><label className="label" htmlFor="c-street">Ulice a č. p.</label><input id="c-street" className="input" required value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} autoComplete="street-address" /></div>
          <div className="grid grid-cols-[1fr_120px] gap-4">
            <div><label className="label" htmlFor="c-city">Město</label><input id="c-city" className="input" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} autoComplete="address-level2" /></div>
            <div><label className="label" htmlFor="c-zip">PSČ</label><input id="c-zip" className="input" required inputMode="numeric" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} autoComplete="postal-code" /></div>
          </div>
          <div><label className="label" htmlFor="c-note">Poznámka pro dopravce (přístup, parkování, kdy jste doma)</label><textarea id="c-note" className="textarea" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        </section>
        <section>
          <h2 className="h3 mb-1">Zásilky a termíny</h2>
          <p className="text-sm text-muted mb-4">Zboží jede přímo od partnerů. Každá zásilka má vlastní termín — ukazujeme to teď, ne až po objednávce.</p>
          <ShipmentsView shipments={quote.shipments} showCarryUp={carryUp.enabled} />
          {carryUp.enabled && <p className="notice notice-info text-sm mt-3">Vynáška objednána{quote.shipments.some((s) => s.method === "pallet") ? ` — ${carryUp.elevator ? "s výtahem" : `${carryUp.floor}. patro`}` : ""}. Dopravce se s vámi domluví na čase.</p>}
          {!carryUp.enabled && <p className="text-sm text-muted mt-3">Dovoz ke krajnici / před dům. Vynášku lze přidat <Link href="/kosik" className="link">v košíku</Link>.</p>}
          {installRequested && <p className="notice notice-info text-sm mt-3">Máte zájem o pokládku — po odeslání objednávky vás spojíme s podlahářem z okolí.</p>}
        </section>
        <section className="panel">
          <h2 className="h3">Platba</h2>
          <p className="text-ink-soft mt-2">Bankovním převodem. Po potvrzení dostupnosti u dodavatelů (obvykle do 1 pracovního dne) pošleme e-mailem platební údaje. Zboží se expeduje po připsání platby. Platbu kartou a na splátky připravujeme.</p>
        </section>
      </div>
      <aside className="lg:col-span-5">
        <div className="panel lg:sticky lg:top-24">
          <p className="eyebrow">Shrnutí objednávky</p>
          <ul className="mt-4 divide-y divide-line text-sm">{quote.lines.map((l) => <li key={`${l.kind}-${l.id}`} className="py-2 flex justify-between gap-3"><span className="min-w-0 truncate">{l.qty}× {l.name}</span><span className="tabular-nums shrink-0">{fmtCzk(l.lineTotal)}</span></li>)}</ul>
          <dl className="mt-3 space-y-1.5 text-sm border-t border-line pt-3">
            <div className="flex justify-between"><dt className="text-muted">Zboží</dt><dd className="tabular-nums">{fmtCzk(quote.itemsTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Doprava</dt><dd className="tabular-nums">{quote.shippingTotal === 0 ? "zdarma" : fmtCzk(quote.shippingTotal)}</dd></div>
            {quote.carryUpTotal > 0 && <div className="flex justify-between"><dt className="text-muted">Vynáška</dt><dd className="tabular-nums">{fmtCzk(quote.carryUpTotal)}</dd></div>}
          </dl>
          <div className="flex justify-between items-baseline border-t border-ink mt-3 pt-3"><span>Celkem vč. DPH</span><span className="text-2xl tabular-nums">{fmtCzk(quote.total)}</span></div>
          <label className="check items-start text-sm mt-5"><input type="checkbox" className="mt-1" checked={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.checked })} /><span>Souhlasím s obchodními podmínkami a beru na vědomí, že dovoz je ke krajnici.</span></label>
          {err && <p className="notice notice-danger text-sm mt-3">{err}</p>}
          <button className="btn btn-accent btn-lg w-full mt-4" disabled={busy}>{busy ? "Odesílám…" : "Odeslat závaznou objednávku"}</button>
          <Link href="/kosik" className="btn btn-ghost w-full mt-2 text-ink-soft">Zpět do košíku</Link>
        </div>
      </aside>
    </form>
  );
}
