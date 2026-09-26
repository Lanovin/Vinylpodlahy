import Link from "next/link";
import clsx from "clsx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M20 2 37 11.5v21L20 42 3 32.5v-21z" strokeLinejoin="round" />
      <path d="M12 14l8 16 8-16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <Link href="/" className={clsx("inline-flex items-center gap-2 sm:gap-2.5 select-none", light ? "text-white" : "text-ink", className)} aria-label="vinylpodlahy.cz — domů">
      <LogoMark className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" />
      <span className="text-[1.05rem] min-[400px]:text-[1.2rem] sm:text-[1.35rem] tracking-[0.08em] font-light leading-none whitespace-nowrap">
        VINYL<span className="font-normal">PODLAHY</span><span className="opacity-60">.cz</span>
      </span>
    </Link>
  );
}
