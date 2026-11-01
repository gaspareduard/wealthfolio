import { describe, expect, it } from "vitest";

import { readRegimeFromMeta, writeRegimeToMeta } from "./rules";
import { buildTaxView, type TaxActivityInput, type TaxHoldingInput } from "./tax-view";

const buy = (accountId: string, date: string, quantity: number): TaxActivityInput => ({
  accountId,
  assetId: "VWCE",
  activityType: "BUY",
  date,
  quantity,
  amount: null,
});

const holding = (
  accountId: string,
  quantity: number,
  marketValue: number | null,
  costBasis: number | null,
  assetId = "VWCE",
): TaxHoldingInput => ({ accountId, assetId, symbol: assetId, quantity, marketValue, costBasis });

describe("Romanian tax view", () => {
  it("rates intermediary lots by FIFO holding period", () => {
    const view = buildTaxView({
      accounts: [{ id: "x", name: "XTB" }],
      holdings: [holding("x", 8, 1000, 840)],
      activities: [
        buy("x", "2025-01-10", 4),
        buy("x", "2026-06-01", 6),
        { ...buy("x", "2026-07-01", 2), activityType: "SELL" },
      ],
      asOf: "2026-10-31",
    });
    const xtb = view.accounts[0];
    expect(xtb.regime).toBe("ro-intermediary");
    expect(xtb.regimeAssumed).toBe(true);
    // The sell consumed the oldest lot first.
    expect(xtb.positions[0].lots.map((lot) => [lot.date, lot.quantity, lot.long])).toEqual([
      ["2025-01-10", 2, true],
      ["2026-06-01", 6, false],
    ]);
    // Gain 160 over 8 units = 20 per unit: 2 units at 3% and 6 units at 6%.
    expect(xtb.taxLow).toBeCloseTo(8.4);
    expect(xtb.taxHigh).toBeCloseTo(8.4);
    expect(xtb.nextLowerRateDate).toBe("2027-06-01");
    expect(xtb.sellsInYear).toBe(1);
  });

  it("gives undated units a 3%-6% range and a loss no tax", () => {
    const activities = [buy("x", "2026-09-01", 5)];
    const ranged = buildTaxView({
      accounts: [{ id: "x", name: "XTB" }],
      holdings: [holding("x", 10, 1200, 1000)],
      activities,
      asOf: "2026-10-31",
    }).accounts[0].positions[0];
    expect(ranged.undatedQuantity).toBe(5);
    expect(ranged.taxLow).toBeCloseTo(9);
    expect(ranged.taxHigh).toBeCloseTo(12);
    const loss = buildTaxView({
      accounts: [{ id: "x", name: "XTB" }],
      holdings: [holding("x", 5, 450, 500)],
      activities,
      asOf: "2026-10-31",
    }).accounts[0];
    expect([loss.taxLow, loss.taxHigh]).toEqual([0, 0]);
  });

  it("nets self-declared gains and losses and keeps unknown cost unknown", () => {
    const gain = buildTaxView({
      accounts: [{ id: "i", name: "IBKR" }],
      holdings: [holding("i", 1, 180, 100), holding("i", 1, 70, 100, "WIRE")],
      activities: [buy("i", "2026-01-05", 1)],
      asOf: "2026-10-31",
    }).accounts[0];
    expect(gain.unrealizedNet).toBeCloseTo(50);
    expect(gain.taxLow).toBeCloseTo(8);
    // Holding period does not change the 16% rate.
    expect(gain.positions.find((p) => p.symbol === "VWCE")?.lots[0].long).toBeNull();
    const losing = buildTaxView({
      accounts: [{ id: "i", name: "IBKR" }],
      holdings: [holding("i", 1, 60, 100)],
      activities: [],
      asOf: "2026-10-31",
    }).accounts[0];
    expect(losing.taxLow).toBe(0);
    expect(losing.lossCarryForward).toBeCloseTo(40);
    const unknown = buildTaxView({
      accounts: [{ id: "i", name: "IBKR" }],
      holdings: [holding("i", 1, 60, null)],
      activities: [],
      asOf: "2026-10-31",
    });
    expect(unknown.accounts[0].taxLow).toBeNull();
    expect(unknown.ifSoldLow).toBeNull();
  });

  it("prefers the saved regime and leaves unknown brokers unset", () => {
    const view = buildTaxView({
      accounts: [
        { id: "a", name: "IBKR", meta: writeRegimeToMeta(null, "ro-intermediary") },
        { id: "b", name: "Some bank" },
      ],
      holdings: [holding("a", 1, 110, 100), holding("b", 1, 110, 100)],
      activities: [],
      asOf: "2026-10-31",
    });
    expect(view.accounts[0]).toMatchObject({ regime: "ro-intermediary", regimeAssumed: false });
    expect(view.accounts[1]).toMatchObject({ regime: null, taxLow: null });
    expect(view.ifSoldLow).toBeNull();
  });

  it("stores the regime without dropping other meta entries", () => {
    const meta = writeRegimeToMeta(
      JSON.stringify({ accounting: { costBasisMethod: "WAC" } }),
      "self-declared",
    );
    expect(JSON.parse(meta)).toEqual({
      accounting: { costBasisMethod: "WAC" },
      roTax: { regime: "self-declared" },
    });
    expect(readRegimeFromMeta(meta)).toBe("self-declared");
    expect(readRegimeFromMeta("not json")).toBeNull();
  });

  it("derives CASS bands from the minimum wage", () => {
    const view = buildTaxView({ accounts: [], holdings: [], activities: [], asOf: "2026-10-31" });
    expect(view.cassBands.map((band) => band.dueRon)).toEqual([2430, 4860, 9720]);
    expect(view.cassBands[0].fromRon).toBe(24300);
  });
});
