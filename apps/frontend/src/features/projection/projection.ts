/** Choices offered in the Projection tab. Rates are yearly, in percent. */
export const PROJECTION_RATES = [-5, 0, 3, 5, 8] as const;
export const PROJECTION_YEARS = [1, 3, 5, 10, 20, 30] as const;
export const MONTHLY_PRESETS = [0, 600, 800, 1000] as const;
export const MILESTONES = [10_000, 25_000, 50_000, 100_000, 250_000] as const;
export const MAX_MONTHLY = 100_000;

export interface ProjectionInput {
  /** Today's value, the starting point. */
  start: number;
  /** Added at each month end. */
  monthly: number;
  /** Yearly effective return in percent, compounded monthly. */
  ratePct: number;
  years: number;
  /** First month of the projection, `YYYY-MM-DD`. */
  from: string;
}

export interface ProjectionPoint {
  month: number;
  date: string;
  value: number;
  /** Starting value plus every monthly amount so far. */
  paidIn: number;
}

/** `YYYY-MM-DD` of `day` moved by `months`, clamped to the month's last day. */
export function addMonths(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * The value month by month at a constant yearly return, with the monthly amount
 * added at each month end. Nominal, before fees, tax and inflation.
 */
export function project({
  start,
  monthly,
  ratePct,
  years,
  from,
}: ProjectionInput): ProjectionPoint[] {
  const monthlyRate = (1 + ratePct / 100) ** (1 / 12) - 1;
  const points: ProjectionPoint[] = [{ month: 0, date: from, value: start, paidIn: start }];
  let value = start;
  for (let month = 1; month <= years * 12; month++) {
    value = value * (1 + monthlyRate) + monthly;
    points.push({ month, date: addMonths(from, month), value, paidIn: start + monthly * month });
  }
  return points;
}

export type MilestoneState =
  | { target: number; state: "reached" }
  | { target: number; state: "later"; point: ProjectionPoint }
  | { target: number; state: "beyond" };

/** When the projected value first reaches each target, if within the period. */
export function milestones(points: ProjectionPoint[], targets: readonly number[] = MILESTONES) {
  return targets.map((target): MilestoneState => {
    const index = points.findIndex((point) => point.value >= target);
    if (index === 0) return { target, state: "reached" };
    if (index < 0) return { target, state: "beyond" };
    return { target, state: "later", point: points[index] };
  });
}

/** One point per whole year, starting with today. */
export function yearlyRows(points: ProjectionPoint[]): ProjectionPoint[] {
  return points.filter((point) => point.month % 12 === 0);
}

/** The final value at the lowest and highest offered rates. */
export function projectionRange(input: Omit<ProjectionInput, "ratePct">): [number, number] {
  const end = (ratePct: number) => project({ ...input, ratePct }).at(-1)?.value ?? input.start;
  return [end(Math.min(...PROJECTION_RATES)), end(Math.max(...PROJECTION_RATES))];
}

/** A monthly amount typed by the user, or null when it is not usable. */
export function parseMonthly(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= MAX_MONTHLY ? value : null;
}
