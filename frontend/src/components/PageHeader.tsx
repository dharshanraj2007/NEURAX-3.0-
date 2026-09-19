import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status?: ReactNode;
}) {
  return (
    <header className="border-b border-white/10 pb-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--series-1)]">{eyebrow}</p>
      <div className="mt-1.5 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">{title}</h1>
        {status}
      </div>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
    </header>
  );
}
