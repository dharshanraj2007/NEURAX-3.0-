export const CLASS_META: Record<string, { label: string; description: string; color: string }> = {
  crazing: {
    label: "Crazing",
    description: "Fine, net-like surface cracks - typically from thermal or mechanical fatigue during rolling.",
    color: "var(--series-1)",
  },
  inclusion: {
    label: "Inclusion",
    description: "Foreign material embedded in the steel surface during casting or rolling - raw-material intrinsic.",
    color: "var(--series-2)",
  },
  patches: {
    label: "Patches",
    description: "Irregular surface patches or discoloration, often from scale or uneven oxidation.",
    color: "var(--series-3)",
  },
  pitted_surface: {
    label: "Pitted Surface",
    description: "Small pits or craters on the surface, often from contamination or localized corrosion.",
    color: "var(--series-4)",
  },
  "rolled-in_scale": {
    label: "Rolled-in Scale",
    description: "Oxide mill scale pressed into the strip surface during hot rolling.",
    color: "var(--series-5)",
  },
  scratches: {
    label: "Scratches",
    description: "Linear surface marks from mechanical contact during handling or transport.",
    color: "var(--series-7)",
  },
};

export const CLASS_ORDER = Object.keys(CLASS_META);
