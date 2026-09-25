import { Header } from "./Header";
import { Footer } from "./Footer";
import { content as contentRepo } from "@/lib/db/repos";

/** Veřejný obal stránky: header + footer. Obsah patičky se čte z administrace. */
export function Site({ children, overlay = false }: { children: React.ReactNode; overlay?: boolean }) {
  const content = contentRepo.get();
  return (
    <>
      <Header overlay={overlay} />
      <main className={overlay ? "" : "flex-1"}>{children}</main>
      <Footer content={content} />
    </>
  );
}
