export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Render an absolute date string as a relative phrase ("3 days ago") computed at
 * display time, so it never goes stale. Robust to unparseable input — a value
 * that isn't a real date (e.g. a legacy "3 days ago" baked in at generation
 * time) is returned verbatim rather than mangled.
 */
export function formatRelativeDate(dateStr: string, nowMs: number = Date.now()): string {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return dateStr;

  const day = 86_400_000;
  const days = Math.floor((nowMs - t) / day);

  if (days < 0) return new Date(t).toISOString().slice(0, 10); // future → show the date
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "last week" : `${weeks} weeks ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "last month" : `${months} months ago`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "last year" : `${years} years ago`;
}
