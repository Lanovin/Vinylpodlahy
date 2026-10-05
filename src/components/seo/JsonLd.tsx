/** Vykreslí JSON-LD jako <script>. `<` se nahrazuje, aby se řetězec z dat nemohl dostat ven ze značky (XSS) — viz dokumentace Next.js, JSON-LD. */
export function JsonLd({ data }: { data: object | null | undefined }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
