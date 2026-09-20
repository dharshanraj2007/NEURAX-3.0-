import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";

type Tone = "good" | "warning" | "critical" | "info" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  good: "text-status-good",
  warning: "text-status-warning",
  critical: "text-status-critical",
  info: "text-status-info",
  neutral: "text-ink-muted",
};

const ICON_TONE: Record<Tone, string> = {
  good: "text-status-good bg-status-good-bg",
  warning: "text-status-warning bg-status-warning-bg",
  critical: "text-status-critical bg-status-critical-bg",
  info: "text-status-info bg-status-info-bg",
  neutral: "text-ink-muted bg-bg",
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone = "neutral",
  emphasize = false,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: Tone;
  emphasize?: boolean;
}) {
  return (
    <Card className={cn(emphasize && "border-status-critical/40 bg-status-critical-bg/40")}>
      <div className="flex items-start justify-between p-4">
        <div>
          <div className="font-label text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums text-ink">{value}</div>
          {sublabel && <div className={cn("mt-1 text-xs font-medium", TONE_TEXT[tone])}>{sublabel}</div>}
        </div>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", ICON_TONE[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
