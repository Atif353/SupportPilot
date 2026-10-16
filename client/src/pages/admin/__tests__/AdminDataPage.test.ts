import { describe, expect, it } from "vitest";
import { sortNewestFirst } from "../AdminDataPage";

describe("admin list ordering", () => {
  it("puts the most recent activity first and undated rows last", () => {
    const rows = [
      { _id: "old", lastMessageAt: "2026-10-01T10:00:00Z" },
      { _id: "undated" },
      { _id: "new", lastMessageAt: "2026-10-12T10:00:00Z" },
      { _id: "updated", updatedAt: "2026-10-05T10:00:00Z" },
    ];
    expect(sortNewestFirst(rows).map((row) => row._id)).toEqual([
      "new",
      "updated",
      "old",
      "undated",
    ]);
  });

  it("does not mutate its input", () => {
    const rows = [
      { _id: "a", createdAt: "2026-01-01" },
      { _id: "b", createdAt: "2026-02-01" },
    ];
    sortNewestFirst(rows);
    expect(rows.map((row) => row._id)).toEqual(["a", "b"]);
  });
});
