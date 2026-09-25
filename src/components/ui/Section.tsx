import clsx from "clsx";

export function Section({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={clsx("py-14 md:py-20", className)}><div className="container">{children}</div></section>;
}

export function SectionHead({ eyebrow, title, text, align = "left", className }: { eyebrow?: string; title: string; text?: string; align?: "left" | "center"; className?: string }) {
  return (
    <div className={clsx("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <h2 className="h2">{title}</h2>
      {text && <p className="lead mt-4">{text}</p>}
    </div>
  );
}
