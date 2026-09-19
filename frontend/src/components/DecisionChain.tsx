import { Link } from "react-router-dom";
import { ProvenanceBadge, type Provenance } from "./ProvenanceBadge";

export interface ChainNode {
  label: string;
  value: string;
  to?: string;
  provenance?: Provenance;
}

// The signature "show connections, not just data" component: each stage of
// the quality -> process -> root-cause -> constraint -> throughput ->
// economics -> recommendation story, as one connected object instead of
// separate unrelated cards. Nodes are clickable only when a real route
// backs them (the same URLs the existing drill-through chain already uses -
// this component never invents a new navigation path).
export function DecisionChain({ nodes }: { nodes: ChainNode[] }) {
  return (
    <div className="flex flex-col gap-0 overflow-x-auto lg:flex-row lg:items-stretch lg:gap-0">
      {nodes.map((node, i) => (
        <div key={node.label} className="flex flex-col lg:flex-row lg:items-stretch">
          <ChainCard node={node} />
          {i < nodes.length - 1 && <ChainArrow />}
        </div>
      ))}
    </div>
  );
}

function ChainCard({ node }: { node: ChainNode }) {
  const inner = (
    <div
      className={`flex min-w-[118px] flex-1 flex-col gap-1 rounded-md border border-white/10 bg-[var(--surface-1)] px-2.5 py-2.5 transition-colors ${
        node.to ? "hover:border-[var(--series-1)]/50 hover:bg-[var(--surface-2)]" : ""
      }`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{node.label}</span>
      <span className="text-sm font-semibold leading-tight text-[var(--text-primary)]">{node.value}</span>
      {node.provenance && <ProvenanceBadge kind={node.provenance} />}
    </div>
  );
  return node.to ? (
    <Link to={node.to} className="flex flex-1">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ChainArrow() {
  return (
    <div className="flex shrink-0 items-center justify-center px-1 py-1 text-[var(--text-muted)] lg:px-0">
      <svg
        className="rotate-90 lg:rotate-0"
        width="18"
        height="14"
        viewBox="0 0 20 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M1 8h16M13 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
