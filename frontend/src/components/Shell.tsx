import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { SKUS, TIME_WINDOWS, useAppFilters } from "../context/AppFilters";
import { useTheme, type ThemeChoice } from "../context/ThemeContext";

const NAV = [
  { to: "/", label: "Overview", icon: GaugeIcon },
  { to: "/agent", label: "Automation Agent", icon: BotIcon },
  { to: "/inspection", label: "Inspection", icon: ScanIcon },
  { to: "/defects", label: "Defects", icon: AlertIcon },
  { to: "/root-cause", label: "Root Cause", icon: LinkIcon },
  { to: "/production-flow", label: "Production Flow", icon: FlowIcon },
  { to: "/economics", label: "Economics", icon: DollarIcon },
  { to: "/recommendations", label: "Recommendations", icon: BulbIcon },
  { to: "/data", label: "Data", icon: DatabaseIcon },
  { to: "/methodology", label: "Methodology", icon: DocIcon },
];

export function Shell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close on route change (navigation via a nav link or any in-app Link).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  // Close on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-svh bg-[var(--surface-0)]">
      {/* Mobile/tablet backdrop - click outside to close */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--overlay)] lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-r border-white/10 bg-[var(--surface-1)] transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-56 lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--series-1)] text-sm font-bold text-white">
            IQ
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight tracking-wide text-[var(--text-primary)]">INSPECTIQ</p>
            <p className="text-[11px] leading-tight text-[var(--text-muted)]">Defect Root-Cause Assistant</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="ml-auto rounded-md p-1.5 text-[var(--text-muted)] hover:bg-white/5 lg:hidden"
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "border-[var(--series-1)] bg-[var(--series-1)]/10 text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3 text-[11px] leading-snug text-[var(--text-muted)]">
          All figures computed live from real datasets. No mock data.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenDrawer={() => setDrawerOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function TopBar({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { timeWindow, setTimeWindow, sku, setSku, latestBatchId, totalBatches } = useAppFilters();
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      api
        .get<{ status: string }>("/api/health")
        .then(() => setHealthy(true))
        .catch(() => setHealthy(false));
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10 bg-[var(--surface-1)] px-4 py-2.5 text-xs sm:px-6">
      <button
        onClick={onOpenDrawer}
        className="flex items-center gap-2 rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-white/5 lg:hidden"
        aria-label="Open navigation"
      >
        <MenuIcon />
        <span className="text-sm font-semibold text-[var(--text-primary)]">INSPECTIQ</span>
      </button>

      <div className="hidden items-center gap-x-5 gap-y-2 sm:flex sm:flex-wrap">
        <TopBarField label="Plant / Line">
          <select
            disabled
            className="cursor-not-allowed rounded border border-white/10 bg-[var(--surface-2)] px-2 py-1 text-[var(--text-secondary)]"
            title="Single-line dataset - only one real production line exists in the source data"
          >
            <option>Steel Sheet Line A</option>
          </select>
        </TopBarField>

        <TopBarField label="Latest Batch">
          <span className="tabular-nums rounded border border-white/10 bg-[var(--surface-2)] px-2 py-1 text-[var(--text-secondary)]">
            {latestBatchId !== null ? `#${latestBatchId}` : "..."}
            {totalBatches !== null && (
              <span className="text-[var(--text-muted)]"> / {totalBatches.toLocaleString()} real batches</span>
            )}
          </span>
        </TopBarField>

        <TopBarField label="Product / Variant">
          <select
            value={sku}
            onChange={(e) => setSku(e.target.value as (typeof SKUS)[number])}
            className="rounded border border-white/10 bg-[var(--surface-2)] px-2 py-1 text-[var(--text-secondary)] focus:border-[var(--series-1)] focus:outline-none"
          >
            {SKUS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All SKUs" : s}
              </option>
            ))}
          </select>
        </TopBarField>

        <TopBarField label="Time Range">
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(Number(e.target.value))}
            className="rounded border border-white/10 bg-[var(--surface-2)] px-2 py-1 text-[var(--text-secondary)] focus:border-[var(--series-1)] focus:outline-none"
          >
            {TIME_WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </TopBarField>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: healthy ? "var(--status-good)" : healthy === false ? "var(--status-critical)" : "var(--text-muted)" }}
          />
          <span className="hidden text-[var(--text-secondary)] sm:inline">
            {healthy === null ? "Checking..." : healthy ? "System Healthy" : "Backend Unreachable"}
          </span>
        </div>
      </div>
    </div>
  );
}

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: () => ReactNode }[] = [
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "system", label: "System", icon: SystemIcon },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-[var(--surface-2)] p-0.5">
      {THEME_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          aria-label={`${opt.label} theme`}
          aria-pressed={theme === opt.value}
          className={`flex items-center justify-center rounded p-1.5 transition-colors ${
            theme === opt.value
              ? "bg-[var(--series-1)] text-white"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {opt.icon()}
        </button>
      ))}
    </div>
  );
}

function TopBarField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function iconProps() {
  return { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
}

function MenuIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg {...iconProps()} width="14" height="14">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" strokeLinejoin="round" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg {...iconProps()} width="14" height="14">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}
function SystemIcon() {
  return (
    <svg {...iconProps()} width="14" height="14">
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
    </svg>
  );
}
function GaugeIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 21a9 9 0 1 1 9-9" strokeLinecap="round" />
      <path d="M12 12l4-4" strokeLinecap="round" />
    </svg>
  );
}
function BotIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="9" width="16" height="11" rx="2" />
      <path d="M12 9V5m0 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" strokeLinecap="round" />
      <circle cx="9" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M2 12h2M20 12h2" strokeLinecap="round" />
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3" strokeLinecap="round" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
      <path d="M12 10v4" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}
function FlowIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="4" width="6" height="6" rx="1" />
      <rect x="15" y="14" width="6" height="6" rx="1" />
      <path d="M9 7h4a3 3 0 0 1 3 3v4" strokeLinecap="round" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M8.6 10.7l7-3.2M8.6 13.3l7 3.2" strokeLinecap="round" />
    </svg>
  );
}
function DollarIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 2v20M17 6.5c0-1.9-2.2-3-5-3s-5 1.2-5 3c0 4 10 2.4 10 6.5 0 1.9-2.2 3-5 3s-5-1.1-5-3" strokeLinecap="round" />
    </svg>
  );
}
function BulbIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M9 18h6M10 21h4" strokeLinecap="round" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6v.5h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z" strokeLinejoin="round" />
    </svg>
  );
}
function DatabaseIcon() {
  return (
    <svg {...iconProps()}>
      <ellipse cx="12" cy="5" rx="7" ry="2.5" />
      <path d="M5 5v14c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5" />
      <path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 12h6M9 16h6M9 8h2" strokeLinecap="round" />
    </svg>
  );
}
