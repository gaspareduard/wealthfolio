import { RO_TAX_RULES, guessRegime, readRegimeFromMeta, type RoTaxRegimeId } from "./rules";

/**
 * Romanian tax view of current holdings: which regime covers each account, what
 * was sold in the tax year, and roughly what selling everything on `asOf` would
 * trigger. An illustration in the base currency, not a tax calculation: the
 * taxable amount is computed in lei at BNR rates, per sale.
 *
 * Holding periods come from the account's BUY/SELL activities, first in, first
 * out, as Romanian intermediaries apply them. Units without a recorded buy have
 * an unknown holding period, so the 3% / 6% rate becomes a range.
 */

export interface TaxAccountInput {
  id: string;
  name: string;
  meta?: string | null;
}

export interface TaxHoldingInput {
  accountId: string;
  assetId: string;
  symbol: string;
  name?: string | null;
  quantity: number;
  marketValue: number | null;
  costBasis: number | null;
}

export interface TaxActivityInput {
  accountId: string;
  assetId: string;
  activityType: string;
  date: string | Date;
  quantity: number | null;
  amount: number | null;
}

export interface TaxLot {
  date: string;
  quantity: number;
  daysHeld: number;
  /** Null when holding period does not change the rate. */
  long: boolean | null;
  longFrom: string | null;
}

export interface TaxPosition {
  assetId: string;
  symbol: string;
  name: string | null;
  quantity: number;
  marketValue: number | null;
  costBasis: number | null;
  gain: number | null;
  lots: TaxLot[];
  undatedQuantity: number;
  taxLow: number | null;
  taxHigh: number | null;
}

export interface TaxAccountView {
  accountId: string;
  accountName: string;
  regime: RoTaxRegimeId | null;
  /** True when the regime is a guess from the account name, not a saved choice. */
  regimeAssumed: boolean;
  positions: TaxPosition[];
  unrealizedNet: number | null;
  taxLow: number | null;
  taxHigh: number | null;
  lossCarryForward: number | null;
  nextLowerRateDate: string | null;
  sellsInYear: number;
}

export interface CassBand {
  fromRon: number;
  toRon: number | null;
  dueRon: number;
}

export interface TaxView {
  asOf: string;
  taxYear: number;
  accounts: TaxAccountView[];
  ifSoldLow: number | null;
  ifSoldHigh: number | null;
  sellsInYear: number;
  cassBands: CassBand[];
}

const QUANTITY_EPSILON = 1e-9;

export function toIsoDay(value: string | Date): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Null-safe sum: unknown stays unknown, never zero. */
function completeSum(values: (number | null)[]): number | null {
  return values.some((value) => value === null)
    ? null
    : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

/** Remaining recorded buy lots, oldest first, after FIFO sells. */
export function remainingLots(
  activities: TaxActivityInput[],
  accountId: string,
  assetId: string,
  asOf: string,
): { lots: { date: string; quantity: number }[]; undatedSold: number } {
  const lots: { date: string; quantity: number }[] = [];
  let undatedSold = 0;
  const rows = activities
    .filter((a) => a.accountId === accountId && a.assetId === assetId && toIsoDay(a.date) <= asOf)
    .map((a) => ({ ...a, day: toIsoDay(a.date) }))
    .sort((a, b) => a.day.localeCompare(b.day));
  for (const row of rows) {
    const quantity = Math.abs(row.quantity ?? 0);
    if (row.activityType === "BUY") {
      lots.push({ date: row.day, quantity });
    } else if (row.activityType === "SELL") {
      let left = quantity;
      while (left > QUANTITY_EPSILON && lots.length) {
        const used = Math.min(left, lots[0].quantity);
        lots[0].quantity -= used;
        left -= used;
        if (lots[0].quantity <= QUANTITY_EPSILON) lots.shift();
      }
      undatedSold += left;
    }
  }
  return { lots, undatedSold };
}

function positionView(
  holding: TaxHoldingInput,
  activities: TaxActivityInput[],
  regime: RoTaxRegimeId | null,
  asOf: string,
): TaxPosition {
  const { marketValue, costBasis, quantity } = holding;
  const gain = marketValue === null || costBasis === null ? null : marketValue - costBasis;
  const recordedLots = remainingLots(activities, holding.accountId, holding.assetId, asOf);
  const { undatedSold } = recordedLots;
  let { lots } = recordedLots;
  const recorded = lots.reduce((total, lot) => total + lot.quantity, 0);
  let undated = quantity - recorded;
  // Recorded buys that do not reconcile with the holding cannot date its units.
  if (undated < -QUANTITY_EPSILON || undatedSold > QUANTITY_EPSILON) {
    lots = [];
    undated = quantity;
  }
  undated = Math.max(0, undated);
  const intermediary = regime === "ro-intermediary" ? RO_TAX_RULES.regimes[regime] : null;
  const lotViews: TaxLot[] = lots.map((lot) => {
    const daysHeld = daysBetween(lot.date, asOf);
    return {
      date: lot.date,
      quantity: lot.quantity,
      daysHeld,
      long: intermediary ? daysHeld >= intermediary.longAfterDays : null,
      longFrom: intermediary ? addDays(lot.date, intermediary.longAfterDays) : null,
    };
  });
  let taxLow: number | null = null;
  let taxHigh: number | null = null;
  if (intermediary && gain !== null && quantity > 0) {
    if (gain <= 0) {
      taxLow = taxHigh = 0;
    } else {
      const perUnit = gain / quantity;
      const longRate = intermediary.rateLongPct / 100;
      const shortRate = intermediary.rateShortPct / 100;
      const dated = lotViews.reduce(
        (total, lot) => total + lot.quantity * (lot.long ? longRate : shortRate),
        0,
      );
      taxLow = perUnit * (dated + undated * longRate);
      taxHigh = perUnit * (dated + undated * shortRate);
    }
  }
  return {
    assetId: holding.assetId,
    symbol: holding.symbol,
    name: holding.name ?? null,
    quantity,
    marketValue,
    costBasis,
    gain,
    lots: lotViews,
    undatedQuantity: undated,
    taxLow,
    taxHigh,
  };
}

export function buildTaxView(input: {
  accounts: TaxAccountInput[];
  holdings: TaxHoldingInput[];
  activities: TaxActivityInput[];
  asOf: string;
}): TaxView {
  const { accounts, holdings, activities, asOf } = input;
  const year = RO_TAX_RULES.taxYear;
  const accountViews = accounts.map<TaxAccountView>((account) => {
    const saved = readRegimeFromMeta(account.meta);
    const regime = saved ?? guessRegime(account.name);
    const positions = holdings
      .filter((holding) => holding.accountId === account.id && holding.quantity > QUANTITY_EPSILON)
      .map((holding) => positionView(holding, activities, regime, asOf))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    const unrealizedNet = completeSum(positions.map((p) => p.gain));
    const view: TaxAccountView = {
      accountId: account.id,
      accountName: account.name,
      regime,
      regimeAssumed: saved === null && regime !== null,
      positions,
      unrealizedNet,
      taxLow: null,
      taxHigh: null,
      lossCarryForward: null,
      nextLowerRateDate: null,
      sellsInYear: activities.filter(
        (a) =>
          a.accountId === account.id &&
          a.activityType === "SELL" &&
          toIsoDay(a.date).startsWith(String(year)),
      ).length,
    };
    if (regime === "ro-intermediary") {
      view.taxLow = completeSum(positions.map((p) => p.taxLow));
      view.taxHigh = completeSum(positions.map((p) => p.taxHigh));
      const upcoming = positions
        .flatMap((p) => p.lots)
        .flatMap((lot) => (lot.long === false && lot.longFrom ? [lot.longFrom] : []))
        .sort();
      view.nextLowerRateDate = upcoming[0] ?? null;
    } else if (regime === "self-declared" && unrealizedNet !== null) {
      const rate = RO_TAX_RULES.regimes["self-declared"].ratePct / 100;
      view.taxLow = view.taxHigh = Math.max(unrealizedNet, 0) * rate;
      view.lossCarryForward = unrealizedNet < 0 ? -unrealizedNet : null;
    } else if (regime === "none") {
      view.taxLow = view.taxHigh = 0;
    }
    return view;
  });
  const taxed = accountViews.filter((a) => a.positions.length > 0);
  const wage = RO_TAX_RULES.minimumGrossWageRon;
  return {
    asOf,
    taxYear: year,
    accounts: accountViews,
    ifSoldLow: completeSum(taxed.map((a) => a.taxLow)),
    ifSoldHigh: completeSum(taxed.map((a) => a.taxHigh)),
    sellsInYear: accountViews.reduce((total, a) => total + a.sellsInYear, 0),
    cassBands: RO_TAX_RULES.cass.bands.map((band) => ({
      fromRon: wage * band.fromWages,
      toRon: band.toWages === null ? null : wage * band.toWages,
      dueRon: (wage * band.baseWages * RO_TAX_RULES.cass.ratePct) / 100,
    })),
  };
}
