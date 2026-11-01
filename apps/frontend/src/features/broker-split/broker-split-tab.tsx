import { getHistoricalValuations } from "@/adapters";
import { useBalancePrivacy } from "@/hooks/use-balance-privacy";
import { useAccounts } from "@/hooks/use-accounts";
import { QueryKeys } from "@/lib/query-keys";
import { useQueries } from "@tanstack/react-query";
import { AnimatedToggleGroup, useAmountFormatting, useDateFormatting } from "@wealthfolio/ui";
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
import { Skeleton } from "@wealthfolio/ui/components/ui/skeleton";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  buildBrokerSplit,
  summarizeBrokerSplit,
  type BrokerSeriesInput,
  type BrokerSplitMetric,
} from "./broker-split";

/** Chart colours in a fixed order per account, so a series keeps its colour. */
const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function BrokerSplitTab() {
  const { t } = useTranslation();
  const [metric, setMetric] = useState<BrokerSplitMetric>("value");
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { formatAmount, formatCompactAmount } = useAmountFormatting();
  const { formatCalendarDate } = useDateFormatting();
  const { isBalanceHidden } = useBalancePrivacy();
  const currency = accounts[0]?.currency ?? "EUR";

  const queries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: QueryKeys.valuationHistory({ type: "account", accountId: account.id }),
      queryFn: () => getHistoricalValuations({ type: "account", accountId: account.id }),
    })),
  });
  const isLoading = accountsLoading || queries.some((query) => query.isLoading);

  const series: BrokerSeriesInput[] = accounts
    .map((account, index) => ({
      accountId: account.id,
      accountName: account.name,
      valuations: queries[index]?.data ?? [],
    }))
    .filter((item) => item.valuations.length > 0);
  const points = buildBrokerSplit(series, metric);
  const summary = summarizeBrokerSplit(series);

  const config: ChartConfig = Object.fromEntries(
    series.map((item, index) => [
      item.accountId,
      { label: item.accountName, color: SERIES_COLORS[index % SERIES_COLORS.length] },
    ]),
  );
  const formatValue = (value: number) =>
    metric === "share"
      ? `${value.toFixed(1)}%`
      : isBalanceHidden
        ? "••••"
        : formatAmount(value, currency);

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!series.length) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icons.Split />
          </EmptyMedia>
          <EmptyTitle>{t("insights:broker_split.empty_title")}</EmptyTitle>
          <EmptyDescription>{t("insights:broker_split.empty_body")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const totalValue = summary.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="grid gap-4 pb-8">
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
        {summary.map((row) => {
          const index = series.findIndex((item) => item.accountId === row.accountId);
          return (
            <Card key={row.accountId}>
              <CardHeader>
                <CardDescription className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-full"
                    style={{ background: SERIES_COLORS[index % SERIES_COLORS.length] }}
                  />
                  {row.accountName}
                </CardDescription>
                <CardTitle className="text-2xl">
                  {isBalanceHidden ? "••••" : formatAmount(row.value, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-sm">
                {t("insights:broker_split.card_note", {
                  share: row.share.toFixed(1),
                  invested: isBalanceHidden ? "••••" : formatAmount(row.invested, currency),
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>{t("insights:broker_split.title")}</CardTitle>
            <CardDescription>
              {t(`insights:broker_split.description_${metric}`, {
                total: isBalanceHidden ? "••••" : formatAmount(totalValue, currency),
              })}
            </CardDescription>
          </div>
          <AnimatedToggleGroup
            variant="secondary"
            size="sm"
            value={metric}
            onValueChange={setMetric}
            items={[
              { value: "value", label: t("insights:broker_split.metric_value") },
              { value: "share", label: t("insights:broker_split.metric_share") },
              { value: "invested", label: t("insights:broker_split.metric_invested") },
            ]}
          />
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="aspect-auto h-[22rem] w-full">
            <AreaChart data={points} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                tickFormatter={(value: string) =>
                  formatCalendarDate(value, { month: "short", year: "2-digit" })
                }
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                domain={metric === "share" ? [0, 100] : [0, "auto"]}
                tickFormatter={(value: number) =>
                  metric === "share"
                    ? `${value}%`
                    : isBalanceHidden
                      ? ""
                      : formatCompactAmount(value, currency, true, "narrowSymbol")
                }
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      typeof value === "string"
                        ? formatCalendarDate(value, { dateStyle: "medium" })
                        : null
                    }
                    formatter={(value, name) => (
                      <div className="flex w-full justify-between gap-4">
                        <span className="text-muted-foreground">
                          {config[String(name)]?.label ?? String(name)}
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatValue(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {series.map((item) => (
                <Area
                  key={item.accountId}
                  dataKey={item.accountId}
                  type="monotone"
                  stackId="brokers"
                  stroke={`var(--color-${item.accountId})`}
                  fill={`var(--color-${item.accountId})`}
                  fillOpacity={0.35}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ChartContainer>
          <p className="text-muted-foreground mt-3 text-xs">{t("insights:broker_split.note")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
