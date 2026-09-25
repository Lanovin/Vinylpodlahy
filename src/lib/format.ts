const czk = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
const num2 = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num1 = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const num0 = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

/** Ceny vč. DPH, zaokrouhlené na celé koruny. */
export function fmtCzk(v: number) { return czk.format(Math.round(v)); }
/** Plochy na dvě desetinná místa. */
export function fmtM2(v: number) { return `${num2.format(v)} m²`; }
export function fmtNum2(v: number) { return num2.format(v); }
export function fmtNum1(v: number) { return num1.format(v); }
export function fmtInt(v: number) { return num0.format(Math.round(v)); }
export function fmtKg(v: number) { return `${num1.format(v)} kg`; }
const numMm = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export function fmtMm(v: number) { return `${numMm.format(v)} mm`; }

export function plural(n: number, one: string, few: string, many: string) {
  const a = Math.abs(Math.round(n));
  if (a === 1) return one;
  if (a >= 2 && a <= 4) return few;
  return many;
}
export function packs(n: number) { return `${fmtInt(n)} ${plural(n, "balení", "balení", "balení")}`; }
export function days(n: number) { return `${fmtInt(n)} ${plural(n, "den", "dny", "dní")}`; }
export function pieces(n: number) { return `${fmtInt(n)} ${plural(n, "kus", "kusy", "kusů")}`; }

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" });
}
export function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
