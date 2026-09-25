import clsx from "clsx";

export function PageHead({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 className="text-2xl">{title}</h1>{text && <p className="text-sm text-muted mt-1 max-w-2xl">{text}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("card p-4 md:p-5", className)}>{children}</div>;
}

export function Status({ value }: { value: string }) {
  const map: Record<string, string> = {
    active: "bg-sage-soft text-sage", paused: "bg-warn-soft text-warn", hidden: "bg-line text-muted",
    new: "bg-accent-soft text-accent-strong", contacted: "bg-warn-soft text-warn", closed: "bg-line text-muted",
    sent: "bg-sage-soft text-sage", done: "bg-line text-muted", confirmed: "bg-sage-soft text-sage", shipped: "bg-sage-soft text-sage", cancelled: "bg-danger-soft text-danger",
    ok: "bg-sage-soft text-sage", failed: "bg-danger-soft text-danger", never: "bg-line text-muted",
  };
  const label: Record<string, string> = { active: "aktivní", paused: "pozastaveno", hidden: "skryto", new: "nové", contacted: "kontaktováno", closed: "uzavřeno", sent: "odesláno", done: "hotovo", confirmed: "potvrzeno", shipped: "expedováno", cancelled: "zrušeno", ok: "OK", failed: "selhalo", never: "nikdy" };
  return <span className={clsx("inline-block rounded-full px-2 py-0.5 text-xs whitespace-nowrap", map[value] ?? "bg-line")}>{label[value] ?? value}</span>;
}

export function Saved({ show, text = "Uloženo." }: { show: boolean; text?: string }) {
  return show ? <p className="notice notice-info text-sm mb-4">{text}</p> : null;
}
