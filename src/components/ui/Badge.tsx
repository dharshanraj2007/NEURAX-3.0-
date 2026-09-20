import React from "react";
import { cn } from "@/lib/utils";
import type { Severity } from "@/types";

type Tone = "good" | "warning" | "critical" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  good: "bg-status-good-bg text-status-good",
  warning: "bg-status-warning-bg text-status-warning",
  critical: "bg-status-critical-bg text-status-critical",
  info: "bg-status-info-bg text-status-info",
  neutral: "bg-bg text-ink-muted border border-border",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const SEVERITY_TONE: Record<Severity, Tone> = { normal: "good", warning: "warning", critical: "critical" };
const SEVERITY_LABEL: Record<Severity, string> = { normal: "Normal", warning: "Warning", critical: "Critical" };

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {SEVERITY_LABEL[severity]}
    </Badge>
  );
}
