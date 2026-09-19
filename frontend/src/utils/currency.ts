// All monetary figures in this app are user-editable cost ASSUMPTIONS (the
// organizer dataset has no currency figures at all - see the Economics and
// Methodology pages) - INR is the display currency throughout, formatted
// with Indian digit grouping (lakh/crore), not a converted "real" price.
export function formatINR(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function formatINRSigned(value: number): string {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}₹${Math.round(Math.abs(value)).toLocaleString("en-IN")}`;
}
