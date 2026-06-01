import { describe, expect, it } from "vitest";
import { slugify, formatRelativeDate } from "./utils.js";

describe("slugify", () => {
  it("lowercases, hyphenates, and trims", () => {
    expect(slugify("How Does Auth Work?")).toBe("how-does-auth-work");
  });

  it("collapses runs of non-alphanumerics and strips edges", () => {
    expect(slugify("  --Foo__Bar!!  ")).toBe("foo-bar");
  });
});

describe("formatRelativeDate", () => {
  const NOW = Date.parse("2026-06-02T12:00:00Z");

  it("renders recent absolute dates as relative phrases", () => {
    expect(formatRelativeDate("2026-06-02T08:00:00Z", NOW)).toBe("today");
    expect(formatRelativeDate("2026-06-01T12:00:00Z", NOW)).toBe("yesterday");
    expect(formatRelativeDate("2026-05-30", NOW)).toBe("3 days ago");
    expect(formatRelativeDate("2026-05-20", NOW)).toBe("last week");
    expect(formatRelativeDate("2026-05-05", NOW)).toBe("4 weeks ago");
    expect(formatRelativeDate("2026-04-02", NOW)).toBe("2 months ago");
    expect(formatRelativeDate("2025-06-02", NOW)).toBe("last year");
  });

  it("returns unparseable input verbatim (e.g. a legacy relative phrase)", () => {
    expect(formatRelativeDate("3 days ago", NOW)).toBe("3 days ago");
    expect(formatRelativeDate("not a date", NOW)).toBe("not a date");
  });

  it("shows the date for future timestamps rather than a negative phrase", () => {
    expect(formatRelativeDate("2026-06-10", NOW)).toBe("2026-06-10");
  });
});
