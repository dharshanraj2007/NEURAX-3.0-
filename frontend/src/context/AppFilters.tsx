import { createContext, useContext, useState, type ReactNode } from "react";

// Real, functional global filters - each one is wired to an actual backend
// parameter somewhere (drift `window`, a real batch_id, real SKU routing),
// not a decorative selector that does nothing. Plant/Line is intentionally
// a single fixed option: this dataset models exactly one production line,
// so a multi-option selector implying otherwise would be dishonest.

export const TIME_WINDOWS = [
  { label: "Last 100 batches", value: 100 },
  { label: "Last 200 batches", value: 200 },
  { label: "Last 500 batches", value: 500 },
  { label: "Last 1,000 batches", value: 1000 },
] as const;

export const SKUS = ["All", "SKU1", "SKU2", "SKU3", "SKU4"] as const;
export type Sku = (typeof SKUS)[number];

interface AppFiltersState {
  timeWindow: number;
  setTimeWindow: (n: number) => void;
  sku: Sku;
  setSku: (s: Sku) => void;
  latestBatchId: number | null;
  setLatestBatchId: (n: number) => void;
  totalBatches: number | null;
  setTotalBatches: (n: number) => void;
}

const AppFiltersContext = createContext<AppFiltersState | null>(null);

export function AppFiltersProvider({ children }: { children: ReactNode }) {
  const [timeWindow, setTimeWindow] = useState(200);
  const [sku, setSku] = useState<Sku>("All");
  const [latestBatchId, setLatestBatchId] = useState<number | null>(null);
  const [totalBatches, setTotalBatches] = useState<number | null>(null);

  return (
    <AppFiltersContext.Provider
      value={{ timeWindow, setTimeWindow, sku, setSku, latestBatchId, setLatestBatchId, totalBatches, setTotalBatches }}
    >
      {children}
    </AppFiltersContext.Provider>
  );
}

export function useAppFilters(): AppFiltersState {
  const ctx = useContext(AppFiltersContext);
  if (!ctx) throw new Error("useAppFilters must be used within AppFiltersProvider");
  return ctx;
}
