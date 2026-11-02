import { formatZonedDateKey } from "@/features/spending/lib/timezone";
import { useBalancePrivacy } from "@/hooks/use-balance-privacy";
import { useCurrentValuation } from "@/hooks/use-current-account-valuations";
import { useSettingsContext } from "@/lib/settings-provider";
import { AnimatedToggleGroup, useAmountFormatting, useDateFormatting } from "@wealthfolio/ui";
import { Button } from "@wealthfolio/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wealthfolio/ui/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@wealthfolio/ui/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@wealthfolio/ui/components/ui/empty";
import { Icons } from "@wealthfolio/ui/components/ui/icons";
import { Input } from "@wealthfolio/ui/components/ui/input";
import { Label } from "@wealthfolio/ui/components/ui/label";
import { Skeleton } from "@wealthfolio/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wealthfolio/ui/components/ui/table";
import { cn } from "@wealthfolio/ui/lib/utils";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  MAX_MONTHLY,
  MONTHLY_PRESETS,
  PROJECTION_RATES,
  PROJECTION_YEARS,
  milestones,
  parseMonthly,
  project,
  projectionRange,
  yearlyRows,
} from "./projection";

const HIDDEN = "••••";

const signClass = (value: number) =>
  value > 0 ? "text-success" : value < 0 ? "text-destructive" : undefined;

export function ProjectionTab() {
  const { t } = useTranslation();
  const { settings } = useSettingsContext();
  const { formatRoundedAmount, formatCompactAmount } = useAmountFormatting();
  const { formatCalendarDate } = useDateFormatting();
  const { isBalanceHidden } = useBalancePrivacy();
  const { currentValuation, isLoading } = useCurrentValuation({ type: "all" });

  const [monthlyText, setMonthlyText] = useState("800");
  // While the field holds something unusable, the last usable amount stays shown.
  const [monthly, setMonthly] = useState(800);
  const [years, setYears] = useState<number>(10);
  const [ratePct, setRatePct] = useState<number>(5);
  const typed = parseMonthly(monthlyText);
  const changeMonthly = (text: string) => {
    setMonthlyText(text);
    const value = parseMonthly(text);
    if (value !== null) setMonthly(value);
  };
  const chartConfig = {
    value: { label: t("insights:projection.series_value"), color: "var(--chart-1)" },
    paidIn: { label: t("insights:projection.series_paidIn"), color: "var(--muted-foreground)" },
  } satisfies ChartConfig;

  const currency = currentValuation?.summary.baseCurrency ?? settings?.baseCurrency ?? "EUR";
  const start = Math.max(0, currentValuation?.summary.totalValueBase ?? 0);
  const from = formatZonedDateKey(new Date(), settings?.timezone);

  const points = useMemo(
    () => project({ start, monthly, ratePct, years, from }),
    [start, monthly, ratePct, years, from],
  );
  const [low, high] = useMemo(
    () => projectionRange({ start, monthly, years, from }),
    [start, monthly, years, from],
  );
  const end = points[points.length - 1];
  const gain = end.value - end.paidIn;

  const money = (value: number) =>
    isBalanceHidden ? HIDDEN : formatRoundedAmount(value, currency);
  const signedMoney = (value: number) =>
    isBalanceHidden ? HIDDEN : `${value > 0 ? "+" : ""}${formatRoundedAmount(value, currency)}`;
  const rateLabel = (rate: number) => `${rate > 0 ? "+" : rate < 0 ? "−" : ""}${Math.abs(rate)}%`;
  const monthYear = (date: string) => formatCalendarDate(date, { month: "short", year: "numeric" });
  const span = (month: number) =>
    month < 12
      ? t("insights:projection.span_months", { months: month })
      : month % 12
        ? t("insights:projection.span_years_months", {
            years: Math.floor(month / 12),
            months: month % 12,
          })
        : t("insights:projection.span_years", { years: month / 12 });
  const yearTicks = points.filter((point) => point.month % 12 === 0).map((point) => point.date);

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!currentValuation) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icons.Target />
          </EmptyMedia>
          <EmptyTitle>{t("insights:projection.empty_title")}</EmptyTitle>
          <EmptyDescription>{t("insights:projection.empty_body")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 pb-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(18rem,22rem)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("insights:projection.title")}</CardTitle>
            <CardDescription>{t("insights:projection.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="projection-monthly">{t("insights:projection.monthly_label")}</Label>
              <Input
                id="projection-monthly"
                type="number"
                inputMode="decimal"
                min={0}
                max={MAX_MONTHLY}
                step={50}
                value={monthlyText}
                aria-invalid={typed === null}
                onChange={(event) => changeMonthly(event.target.value)}
              />
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t("insights:projection.monthly_presets")}
              >
                {MONTHLY_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    size="sm"
                    variant={typed === preset ? "default" : "outline"}
                    aria-pressed={typed === preset}
                    onClick={() => changeMonthly(String(preset))}
                  >
                    {formatRoundedAmount(preset, currency)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">{t("insights:projection.years_label")}</span>
              <AnimatedToggleGroup
                variant="secondary"
                size="sm"
                aria-label={t("insights:projection.years_label")}
                value={String(years)}
                onValueChange={(value) => setYears(Number(value))}
                items={PROJECTION_YEARS.map((option) => ({
                  value: String(option),
                  label: t("insights:projection.years_short", { years: option }),
                }))}
              />
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">{t("insights:projection.rate_label")}</span>
              <AnimatedToggleGroup
                variant="secondary"
                size="sm"
                aria-label={t("insights:projection.rate_label")}
                value={String(ratePct)}
                onValueChange={(value) => setRatePct(Number(value))}
                items={PROJECTION_RATES.map((rate) => ({
                  value: String(rate),
                  label: rateLabel(rate),
                }))}
              />
            </div>
            <div className="bg-muted/40 grid gap-3 rounded-lg p-4" aria-live="polite">
              <div className="grid gap-1">
                <span className="text-muted-foreground text-sm">
                  {t("insights:projection.could_be_worth")}
                </span>
                <strong className="text-3xl font-semibold tabular-nums">{money(end.value)}</strong>
                <span className="text-muted-foreground text-xs">
                  {t("insights:projection.by_when", {
                    date: monthYear(end.date),
                    rate: rateLabel(ratePct),
                  })}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("insights:projection.paid_in")}</dt>
                  <dd className="font-medium tabular-nums">{money(end.paidIn)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("insights:projection.from_returns")}</dt>
                  <dd className={cn("font-medium tabular-nums", signClass(gain))}>
                    {signedMoney(gain)}
                  </dd>
                </div>
              </dl>
            </div>
            <p className="text-muted-foreground text-xs">
              {t("insights:projection.range", {
                low: money(low),
                high: money(high),
                lowRate: rateLabel(Math.min(...PROJECTION_RATES)),
                highRate: rateLabel(Math.max(...PROJECTION_RATES)),
                start: money(start),
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("insights:projection.chart_title")}</CardTitle>
            <CardDescription>{t("insights:projection.chart_description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <ChartContainer config={chartConfig} className="aspect-auto h-[22rem] w-full">
              <AreaChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  ticks={yearTicks}
                  minTickGap={32}
                  tickFormatter={(value: string) => formatCalendarDate(value, { year: "numeric" })}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  domain={[0, "auto"]}
                  tickFormatter={(value: number) =>
                    isBalanceHidden
                      ? ""
                      : formatCompactAmount(value, currency, true, "narrowSymbol")
                  }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_, payload) => {
                        const date = payload?.[0]?.payload?.date;
                        return typeof date === "string" ? monthYear(date) : null;
                      }}
                      formatter={(value, name) => (
                        <div className="flex w-full justify-between gap-4">
                          <span className="text-muted-foreground">
                            {chartConfig[name as keyof typeof chartConfig]?.label ?? String(name)}
                          </span>
                          <span className="font-medium tabular-nums">{money(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  dataKey="value"
                  type="monotone"
                  stroke="var(--color-value)"
                  fill="var(--color-value)"
                  fillOpacity={0.25}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Area
                  dataKey="paidIn"
                  type="monotone"
                  stroke="var(--color-paidIn)"
                  fill="none"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>

            <div className="grid gap-3">
              <h3 className="text-sm font-medium">{t("insights:projection.milestones")}</h3>
              <ul className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
                {milestones(points).map((milestone) => (
                  <li
                    key={milestone.target}
                    className={cn(
                      "grid gap-0.5 rounded-lg border p-3",
                      milestone.state === "beyond" && "opacity-60",
                    )}
                  >
                    <strong className="tabular-nums">
                      {formatRoundedAmount(milestone.target, currency)}
                    </strong>
                    <span className="text-muted-foreground text-sm">
                      {milestone.state === "reached"
                        ? t("insights:projection.milestone_reached")
                        : milestone.state === "beyond"
                          ? t("insights:projection.milestone_beyond", { years })
                          : monthYear(milestone.point.date)}
                    </span>
                    {milestone.state === "later" && (
                      <small className="text-muted-foreground text-xs">
                        {t("insights:projection.milestone_in", {
                          span: span(milestone.point.month),
                        })}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("insights:projection.table_title")}</CardTitle>
          <CardDescription>{t("insights:projection.method")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("insights:projection.column_after")}</TableHead>
                <TableHead>{t("insights:projection.column_date")}</TableHead>
                <TableHead className="text-right">{t("insights:projection.paid_in")}</TableHead>
                <TableHead className="text-right">
                  {t("insights:projection.column_value")}
                </TableHead>
                <TableHead className="text-right">
                  {t("insights:projection.from_returns")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearlyRows(points).map((row) => (
                <TableRow key={row.month}>
                  <TableCell>
                    {row.month === 0
                      ? t("insights:projection.today")
                      : t("insights:projection.span_years", { years: row.month / 12 })}
                  </TableCell>
                  <TableCell>{monthYear(row.date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(row.paidIn)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(row.value)}</TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums", signClass(row.value - row.paidIn))}
                  >
                    {signedMoney(row.value - row.paidIn)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
