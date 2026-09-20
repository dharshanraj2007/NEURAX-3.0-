type ClassValue = string | number | boolean | null | undefined | ClassValue[] | Record<string, boolean | undefined>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else {
      Object.entries(v).forEach(([k, val]) => val && out.push(k));
    }
  };
  inputs.forEach(walk);
  return out.join(" ");
}
