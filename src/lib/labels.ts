import type { MachineStatus, ReviewStatus } from "@/types";

/** Presentation-only label map -- not data, never fetched from the API. */
export const MACHINE_STATUS_LABEL: Record<MachineStatus, string> = {
  running: "Running",
  warning: "Warning",
  down: "Down",
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  auto: "Auto-accepted",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};

export const REVIEW_TONE: Record<ReviewStatus, "good" | "warning" | "critical" | "neutral"> = {
  auto: "good",
  pending_review: "warning",
  approved: "good",
  rejected: "neutral",
};
