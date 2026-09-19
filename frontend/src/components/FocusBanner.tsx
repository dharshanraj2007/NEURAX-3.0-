import { useNavigate } from "react-router-dom";

// Shown when a page was reached via a cross-page drill-through link (a real
// URL query param carried from Defects/Root Cause/Production Flow), so the
// context that produced the current view is visible and reversible, not a
// silent side effect.
export function FocusBanner({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--series-1)]/30 bg-[var(--series-1)]/10 px-4 py-2.5 text-xs text-[var(--text-secondary)]">
      <span>
        <span className="font-medium text-[var(--text-primary)]">Traced: </span>
        {label}
      </span>
      <button onClick={onClear} className="text-[var(--series-1)] hover:underline">
        Clear
      </button>
    </div>
  );
}

export function useClearFocusParam(paramNames: string[]) {
  const navigate = useNavigate();
  return () => {
    const url = new URL(window.location.href);
    paramNames.forEach((p) => url.searchParams.delete(p));
    navigate(url.pathname + url.search, { replace: true });
  };
}
