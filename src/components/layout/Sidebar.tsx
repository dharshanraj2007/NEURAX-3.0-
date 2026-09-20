import React from "react";
import { NavLink } from "react-router-dom";
import { Factory, Gauge, AlertTriangle, BarChart3, Target, ScanEye } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Factory Overview", icon: Factory, end: true, tag: "Real data" },
  { to: "/process-risk-analysis", label: "Process Risk Analysis", icon: Gauge, end: false, tag: "Real data" },
  { to: "/machine-incidents", label: "Machine Incidents", icon: AlertTriangle, end: false, tag: "Demo data" },
  { to: "/product-defects", label: "Product Defects", icon: BarChart3, end: false, tag: "Demo data" },
  { to: "/inspection-intelligence", label: "AI Inspection Intelligence", icon: ScanEye, end: false, tag: "Real model" },
  { to: "/model-performance", label: "Model Performance", icon: Target, end: false, tag: "Demo data" },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-sidebar text-sidebar-text">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-text text-xs font-bold text-sidebar">
          IQ
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">INSPECT-QC</div>
          <div className="font-label text-[10px] uppercase tracking-wider text-sidebar-muted">
            Steelworks Monitor
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end, tag }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-text text-sidebar"
                  : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-text"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <span
                  className={cn(
                    "font-label shrink-0 rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wider",
                    tag === "Real model" || tag === "Real data"
                      ? "bg-status-good/20 text-status-good"
                      : isActive
                      ? "bg-sidebar/10 text-sidebar/60"
                      : "bg-white/5 text-sidebar-muted"
                  )}
                >
                  {tag}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="rounded-lg border border-sidebar-border bg-white/[0.03] px-3 py-3">
          <div className="font-label mb-2 text-[10px] uppercase tracking-wider text-sidebar-muted">
            System Status
          </div>
          <div className="space-y-1.5 text-xs text-sidebar-text">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-status-good" />
              Data Connected
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-status-good" />
              Vision Model Loaded
            </div>
            <div className="flex items-center gap-2 text-sidebar-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-status-info" />
              Advisory software — no live equipment link
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
