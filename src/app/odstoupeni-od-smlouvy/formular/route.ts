import { content } from "@/lib/db/repos";
import { withdrawalForm } from "@/components/legal/withdrawalForm";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/**
 * Formulář pro odstoupení ke stažení / vytištění.
 * GET /odstoupeni-od-smlouvy/formular → samostatná stránka pro tisk; ?format=txt → stažení jako text.
 */
export async function GET(req: Request) {
  const f = withdrawalForm(content.get().contact);
  if (new URL(req.url).searchParams.get("format") === "txt") {
    const txt = [f.title, f.note, "", f.addressee, "", ...f.lines.flatMap((l) => [l, "", ""]), f.footnote, ""].join("\r\n");
    return new Response(txt, { headers: { "content-type": "text/plain; charset=utf-8", "content-disposition": 'attachment; filename="odstoupeni-od-smlouvy.txt"' } });
  }
  const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(f.title)} | vinylpodlahy.cz</title>
<style>
body{font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#17150f;max-width:44rem;margin:2rem auto;padding:0 1rem}
h1{font-size:1.5rem;font-weight:500;margin:0 0 .25rem}.muted{color:#6b665d;font-size:.9rem}
.line{border-bottom:1px solid #999;padding:1.4rem 0 .3rem;margin:0}.bar{display:flex;gap:.5rem;margin:1.5rem 0}
button,a.btn{font:inherit;padding:.6rem 1rem;border:1px solid #17150f;background:#17150f;color:#fff;border-radius:6px;cursor:pointer;text-decoration:none}
a.btn{background:#fff;color:#17150f}@media print{.bar{display:none}body{margin:0}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Vytisknout</button><a class="btn" href="?format=txt">Stáhnout (.txt)</a><a class="btn" href="/odstoupeni-od-smlouvy">Zpět</a></div>
<h1>${esc(f.title)}</h1><p class="muted">${esc(f.note)}</p>
<p><strong>${esc(f.addressee)}</strong></p>
${f.lines.map((l) => `<p class="line">${esc(l)}</p>`).join("\n")}
<p class="muted" style="margin-top:1.5rem">${esc(f.footnote)}</p>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
