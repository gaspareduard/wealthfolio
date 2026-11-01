import { describe, expect, it } from "vitest";

import type { AccountValuation } from "@/lib/types";
import { buildBrokerSplit, summarizeBrokerSplit, type BrokerSeriesInput } from "./broker-split";

const valuation = (date: string, value: number, cost: number): AccountValuation =>
  ({ valuationDate: date, totalValueBase: value, costBasisBase: cost }) as AccountValuation;

const series: BrokerSeriesInput[] = [
  {
    accountId: "ibkr",
    accountName: "IBKR",
    valuations: [valuation("2026-03-04", 100, 97), valuation("2026-03-06", 120, 97)],
  },
  { accountId: "xtb", accountName: "XTB", valuations: [valuation("2026-03-05", 300, 290)] },
];

describe("broker split", () => {
  it("aligns accounts on all dates, zero before start and carried forward after", () => {
    expect(buildBrokerSplit(series, "value")).toEqual([
      { date: "2026-03-04", ibkr: 100, xtb: 0 },
      { date: "2026-03-05", ibkr: 100, xtb: 300 },
      { date: "2026-03-06", ibkr: 120, xtb: 300 },
    ]);
  });

  it("uses cost basis for invested money and percentages for share", () => {
    expect(buildBrokerSplit(series, "invested").at(-1)).toEqual({
      date: "2026-03-06",
      ibkr: 97,
      xtb: 290,
    });
    const share = buildBrokerSplit(series, "share").at(-1);
    expect(share?.ibkr).toBeCloseTo(28.571, 2);
    expect(share?.xtb).toBeCloseTo(71.429, 2);
  });

  it("summarizes the latest split, largest first", () => {
    const summary = summarizeBrokerSplit(series);
    expect(summary.map((row) => [row.accountName, row.value])).toEqual([
      ["XTB", 300],
      ["IBKR", 120],
    ]);
    expect(summary[0].share).toBeCloseTo(71.429, 2);
    expect(summarizeBrokerSplit([])).toEqual([]);
  });
});
