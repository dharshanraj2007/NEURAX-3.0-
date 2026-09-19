// Distinguishes what kind of claim a number is - never decorative, and
// deliberately not attached to every value (only where the distinction is
// load-bearing: root-cause links, what-if outputs, cost assumptions).
export type Provenance = "real" | "derived" | "model" | "simulated" | "assumption" | "advisory";

const META: Record<Provenance, { label: string; color: string }> = {
  real: { label: "Real data", color: "var(--status-good)" },
  derived: { label: "Derived", color: "var(--series-1)" },
  model: { label: "Model output", color: "var(--series-7)" },
  simulated: { label: "Simulated", color: "var(--status-warning)" },
  assumption: { label: "Assumption", color: "var(--series-4)" },
  advisory: { label: "Advisory only", color: "var(--status-serious)" },
};

export function ProvenanceBadge({ kind }: { kind: Provenance }) {
  const m = META[kind];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{ borderColor: `color-mix(in oklab, ${m.color} 40%, transparent)`, color: m.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}
