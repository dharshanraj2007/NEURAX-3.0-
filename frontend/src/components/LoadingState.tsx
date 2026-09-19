export function LoadingState({ label = "Loading real data from the backend..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[var(--surface-1)] px-5 py-8 text-sm text-[var(--text-muted)]">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--series-1)] border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-[var(--status-critical)]/30 bg-[var(--status-critical)]/10 px-5 py-4 text-sm text-[var(--status-critical)]">
      <p className="font-medium">Request failed</p>
      <p className="mt-1 text-[var(--text-secondary)]">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border border-white/15 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-white/5"
        >
          Retry
        </button>
      )}
    </div>
  );
}
