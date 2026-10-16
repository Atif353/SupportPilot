import { describe, expect, it } from "vitest";
import { initials, relativeTime, timeValue } from "../time";

describe("time helpers", () => {
  const now = Date.parse("2026-10-13T12:00:00Z");
  it("formats recent and older timestamps relatively", () => {
    expect(relativeTime("2026-10-13T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-10-13T11:00:00Z", now)).toMatch(/1 hour ago/);
    expect(relativeTime("2026-10-11T12:00:00Z", now)).toMatch(/2 days ago/);
    expect(relativeTime(undefined, now)).toBe("");
  });
  it("treats invalid dates as zero so they sort last", () => {
    expect(timeValue("not a date")).toBe(0);
    expect(timeValue(undefined)).toBe(0);
  });
  it("builds avatar initials", () => {
    expect(initials("sam", "Support")).toBe("SS");
    expect(initials(undefined)).toBe("?");
  });
});
