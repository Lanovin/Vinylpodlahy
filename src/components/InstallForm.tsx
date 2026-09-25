"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function InstallForm({ productId, calculationId, area, productName, source }: { productId: string | null; calculationId: string | null; area: number | null; productName: string | null; source: "product" | "cart" | "page" }) {
  const router = useRouter();
  const [form, setForm] = useState({ zip: "", areaM2: area ? String(area) : "", term: "", name: "", phone: "", email: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true);
    const res = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, areaM2: parseFloat(form.areaM2.replace(",", ".")), productId, calculationId, source }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setErr(d.error ?? "Odeslání se nepodařilo."); }
    router.push("/montaz?ok=1");
  }
  return (
    <form onSubmit={submit} className="panel space-y-4">
      {productName && <p className="text-sm text-muted">Podlaha: <strong className="text-ink">{productName}</strong></p>}
      <div className="grid sm:grid-cols-3 gap-4">
        <div><label className="label" htmlFor="i-zip">PSČ místa pokládky</label><input id="i-zip" className="input" required inputMode="numeric" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
        <div><label className="label" htmlFor="i-area">Plocha (m²)</label><input id="i-area" className="input" required inputMode="decimal" value={form.areaM2} onChange={(e) => setForm({ ...form, areaM2: e.target.value })} /></div>
        <div><label className="label" htmlFor="i-term">Termín</label><input id="i-term" className="input" required placeholder="např. říjen 2026" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} /></div>
      </div>
      <div><label className="label" htmlFor="i-name">Jméno</label><input id="i-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="label" htmlFor="i-phone">Telefon</label><input id="i-phone" type="tel" className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label className="label" htmlFor="i-email">E-mail</label><input id="i-email" type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      </div>
      <div><label className="label" htmlFor="i-note">Poznámka (stav podkladu, patro, demontáž staré podlahy…)</label><textarea id="i-note" className="textarea" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
      {err && <p className="notice notice-danger text-sm">{err}</p>}
      <button className="btn btn-accent btn-lg w-full" disabled={busy}>{busy ? "Odesílám…" : "Poptat pokládku"}</button>
      <p className="text-xs text-muted">Nezávazné. Podlahář se ozve do 2 pracovních dnů s orientační cenou za m².</p>
    </form>
  );
}
