import { useApi } from "../hooks/useApi";
import { api } from "../api/client";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/LoadingState";

const SECTIONS = [
  { id: "problem", label: "Problem Understanding" },
  { id: "data", label: "Data Sources" },
  { id: "vision", label: "Vision Model" },
  { id: "root-cause", label: "Root-Cause Method" },
  { id: "bottleneck", label: "Bottleneck Method" },
  { id: "economics", label: "Profitability Model" },
  { id: "validation", label: "Validation" },
  { id: "limitations", label: "Limitations" },
];

export function Methodology() {
  const doc = useApi<{ text: string }>(() => api.get("/api/methodology"));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <PageHeader
        eyebrow="InspectIQ / Credibility"
        title="Methodology & Data Provenance"
        description="What's real, what's a documented modeling assumption, and why - stated plainly rather than left for someone to discover."
      />

      <nav className="flex flex-wrap gap-2 text-xs">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-white/10 px-3 py-1 text-[var(--text-secondary)] hover:border-[var(--series-1)] hover:text-[var(--text-primary)]">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2">
        <ProvenanceCard
          title="Real, unmodified"
          items={[
            "Model 3 process telemetry (605,620 batches) - organizer-provided Arena simulation output",
            "Model 1 & 2 Design-of-Experiments data (3,000 replications each)",
            "NEU-DET steel surface-defect images + bounding boxes (Figshare DOI 10.6084/m9.figshare.28903550.v1, CC BY 4.0, md5-verified)",
            "Trained YOLOv8 detector weights and isotonic confidence calibration (fit on real held-out validation predictions)",
          ]}
          tone="good"
        />
        <ProvenanceCard
          title="Documented modeling assumptions"
          items={[
            "Which real defect image is likely for a given batch's process-stress pattern (station-affinity table, see below)",
            "Unit price / scrap cost / operating cost (organizer data has no $ figures - editable on the Economics page)",
            "Partial-dependence 'what-if' output sensitivity is a correlational ML association, not a validated causal effect",
          ]}
          tone="warning"
        />
      </div>

      <Section id="problem" title="Problem Understanding">
        <p>
          The hackathon problem statement asks for a unified quality + process-flow + profitability
          decision-support system, not a standalone classifier or KPI dashboard. This product's central story is
          the chain: inspection &rarr; defect &rarr; process/batch &rarr; root cause &rarr; production constraint
          &rarr; throughput impact &rarr; cost/loss &rarr; profitability &rarr; recommendation &rarr; what-if
          simulation - visible end-to-end via the sidebar navigation (Overview through Recommendations).
        </p>
      </Section>

      <Section id="data" title="Data Sources">
        <p>
          The organizer-provided package (<code>Manufacturing Data Shared Facility</code>) is Discrete-Event
          Simulation process telemetry for a steel-sheet stamping line - Blanking, Pressing, Assembly, Paint,
          QC - with no images and no per-unit inspection outcome anywhere in it. The NEU-DET steel
          surface-defect image dataset (real, public, CC-BY-4.0) supplies the vision half. See the Data page for
          live readiness status of every source.
        </p>
      </Section>

      <Section id="vision" title="Vision Model">
        <p>
          YOLOv8n fine-tuned on the real NEU-DET dataset (6 classes, real bounding-box labels), with isotonic
          confidence calibration fit on real held-out validation predictions. Detections below a
          calibration-derived threshold are flagged "uncertain" rather than forced into a class - see the
          Inspection page.
        </p>
      </Section>

      <Section id="root-cause" title="Root-Cause Method">
        <p>
          Because the organizer data has no per-unit inspection outcome, a documented, parameterized simulation
          (station-stress affinity table) links real Model-3 process stress to a likely defect family. A real
          XGBoost classifier is trained on this stream and explained with real SHAP values. The `inclusion`
          class is deliberately given no process affinity as a built-in falsifiability check.
        </p>
      </Section>

      <Section id="bottleneck" title="Bottleneck Method">
        <p>
          Structural pressure ranking (0.6 x utilization + 0.4 x normalized queue) over the full 605,620-batch
          population identifies the constraining resource. A RandomForest fit on a 50,000-batch sample (sampling
          only for training speed) ranks which contended resources' load best explains output variance,
          excluding single-pass gates (Blanking/Paint/Quality) whose utilization mechanically tracks total
          volume rather than independently constraining it.
        </p>
      </Section>

      <Section id="economics" title="Profitability Model">
        <p>
          A transparent, formula-driven calculator (revenue - scrap cost - operating cost), deliberately not a
          black box. Unit price/scrap cost/operating cost are user-editable assumptions (the organizer dataset
          has no $ figures); throughput and defect-rate inputs come from the real measured/simulated reports
          above.
        </p>
      </Section>

      <Section id="validation" title="Validation">
        <p>
          Held-out ROC-AUC per defect class is the primary validity check (see Root Cause page) - `inclusion`
          sits near 0.5 (chance) as designed, while process-linked classes score meaningfully higher. The vision
          detector is calibrated against real held-out validation images, not training images.
        </p>
      </Section>

      <Section id="limitations" title="Limitations">
        <p>
          Model 3's 605,620 rows are independent replications of ONE fixed capacity design, not a capacity-sweep
          experiment - so a station's utilization is confounded with how busy a given day randomly was, and
          partial-dependence "what-if" outputs are directional ML associations, not validated causal effects
          (flagged inline wherever shown). The process-to-defect linkage is a documented simulation, not a
          measured relationship - see the full text below.
        </p>
      </Section>

      <Card title="Full methodology text (served live from the backend)">
        {doc.loading && <LoadingState />}
        {doc.error && <ErrorState message={doc.error} onRetry={doc.reload} />}
        {doc.data && (
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-secondary)]">{doc.data.text}</pre>
        )}
      </Card>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-lg border border-white/10 bg-[var(--surface-1)] p-5">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}

function ProvenanceCard({ title, items, tone }: { title: string; items: string[]; tone: "good" | "warning" }) {
  const color = tone === "good" ? "var(--status-good)" : "var(--status-warning)";
  return (
    <div className="rounded-lg border border-white/10 bg-[var(--surface-1)] p-5">
      <h3 className="text-sm font-semibold" style={{ color }}>
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: color }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
