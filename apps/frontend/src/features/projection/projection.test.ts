import { describe, expect, it } from "vitest";

import {
  addMonths,
  milestones,
  parseMonthly,
  project,
  projectionRange,
  yearlyRows,
} from "./projection";

describe("projection", () => {
  it("adds the monthly amount at each month end with no return", () => {
    const points = project({ start: 1000, monthly: 100, ratePct: 0, years: 1, from: "2026-11-02" });
    expect(points).toHaveLength(13);
    expect(points[0]).toEqual({ month: 0, date: "2026-11-02", value: 1000, paidIn: 1000 });
    expect(points.at(-1)).toMatchObject({
      month: 12,
      date: "2027-11-02",
      value: 2200,
      paidIn: 2200,
    });
  });

  it("compounds the yearly rate monthly", () => {
    const end = project({ start: 1000, monthly: 0, ratePct: 5, years: 2, from: "2026-01-31" }).at(
      -1,
    );
    expect(end?.value).toBeCloseTo(1102.5, 6);
    expect(end?.paidIn).toBe(1000);
  });

  it("matches the old dashboard's 10-year example", () => {
    const end = project({
      start: 5000,
      monthly: 800,
      ratePct: 5,
      years: 10,
      from: "2026-11-01",
    }).at(-1);
    // Month-end annuity at the monthly-equivalent rate, plus the grown start.
    const r = 1.05 ** (1 / 12) - 1;
    expect(end?.value).toBeCloseTo(5000 * 1.05 ** 10 + (800 * ((1 + r) ** 120 - 1)) / r, 6);
  });

  it("keeps month ends inside shorter months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2027-12-31", 2)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 14)).toBe("2028-01-15");
  });

  it("reports when each milestone is reached", () => {
    const points = project({
      start: 12_000,
      monthly: 1000,
      ratePct: 0,
      years: 1,
      from: "2026-11-01",
    });
    const states = milestones(points, [10_000, 20_000, 50_000]);
    expect(states[0]).toEqual({ target: 10_000, state: "reached" });
    expect(states[1]).toMatchObject({ target: 20_000, state: "later", point: { month: 8 } });
    expect(states[2]).toEqual({ target: 50_000, state: "beyond" });
  });

  it("lists one row per year and the range across the offered rates", () => {
    const input = { start: 1000, monthly: 100, years: 3, from: "2026-11-01" };
    expect(yearlyRows(project({ ...input, ratePct: 5 })).map((row) => row.month)).toEqual([
      0, 12, 24, 36,
    ]);
    const [low, high] = projectionRange(input);
    expect(low).toBeLessThan(4600);
    expect(high).toBeGreaterThan(4600);
  });

  it("accepts only usable monthly amounts", () => {
    expect(parseMonthly("800")).toBe(800);
    expect(parseMonthly("")).toBeNull();
    expect(parseMonthly("-1")).toBeNull();
    expect(parseMonthly("abc")).toBeNull();
    expect(parseMonthly("100001")).toBeNull();
  });
});
