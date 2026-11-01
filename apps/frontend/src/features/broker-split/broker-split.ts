import type { AccountValuation } from "@/lib/types";

/**
 * How money is divided between accounts (brokers) over time.
 *
 * - `value`: each account's total value in the base currency.
 * - `invested`: each account's cost basis (money in its holdings), which does not
 *   depend on how deposits were recorded.
 * - `share`: each account's percentage of the combined value.
 *
 * Each account's daily valuations are aligned on the union of dates. Before an
 * account's first valuation it holds nothing (0); a gap after that carries the
 * last known valuation forward.
 */
export type BrokerSplitMetric = "value" | "invested" | "share";

export interface BrokerSeriesInput {
  accountId: string;
  accountName: string;
  valuations: AccountValuation[];
}

export type BrokerSplitPoint = { date: string } & Record<string, number | string>;

export interface BrokerSplitSummary {
  accountId: string;
  accountName: string;
  value: number;
  invested: number;
  share: number;
}

function amountFor(row: AccountValuation, metric: Exclude<BrokerSplitMetric, "share">): number {
  return metric === "invested" ? row.costBasisBase : row.totalValueBase;
}

function aligned(series: BrokerSeriesInput[]): {
  dates: string[];
  rowsByAccount: Map<string, (AccountValuation | null)[]>;
} {
  const dates = [
    ...new Set(series.flatMap((s) => s.valuations.map((v) => v.valuationDate.slice(0, 10)))),
  ].sort();
  const rowsByAccount = new Map<string, (AccountValuation | null)[]>();
  for (const { accountId, valuations } of series) {
    const byDate = new Map(valuations.map((v) => [v.valuationDate.slice(0, 10), v]));
    let last: AccountValuation | null = null;
    rowsByAccount.set(
      accountId,
      dates.map((date) => {
        last = byDate.get(date) ?? last;
        return last;
      }),
    );
  }
  return { dates, rowsByAccount };
}

export function buildBrokerSplit(
  series: BrokerSeriesInput[],
  metric: BrokerSplitMetric,
): BrokerSplitPoint[] {
  const { dates, rowsByAccount } = aligned(series);
  return dates.map((date, index) => {
    const point: BrokerSplitPoint = { date };
    const values = series.map(({ accountId }) => {
      const row = rowsByAccount.get(accountId)?.[index] ?? null;
      return row ? amountFor(row, metric === "share" ? "value" : metric) : 0;
    });
    const total = values.reduce((sum, value) => sum + value, 0);
    series.forEach(({ accountId }, position) => {
      point[accountId] =
        metric === "share" ? (total > 0 ? (values[position] / total) * 100 : 0) : values[position];
    });
    return point;
  });
}

/** Latest value, cost basis and share per account, largest first. */
export function summarizeBrokerSplit(series: BrokerSeriesInput[]): BrokerSplitSummary[] {
  const { dates, rowsByAccount } = aligned(series);
  const last = dates.length - 1;
  const rows = series.map(({ accountId, accountName }) => {
    const row = last >= 0 ? (rowsByAccount.get(accountId)?.[last] ?? null) : null;
    return {
      accountId,
      accountName,
      value: row?.totalValueBase ?? 0,
      invested: row?.costBasisBase ?? 0,
    };
  });
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows
    .map((row) => ({ ...row, share: total > 0 ? (row.value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
}
