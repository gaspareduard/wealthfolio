import { getActivities, getHoldings } from "@/adapters";
import { AccountIcon } from "@/features/account-icon/account-icon";
import { useAccounts } from "@/hooks/use-accounts";
import { HoldingType } from "@/lib/constants";
import { QueryKeys } from "@/lib/query-keys";
import type { Account, ActivityDetails, Holding } from "@/lib/types";
import { useAccountMutations } from "@/pages/settings/accounts/components/use-account-mutations";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useAmountFormatting, useDateFormatting } from "@wealthfolio/ui";
import { Badge } from "@wealthfolio/ui/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wealthfolio/ui/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@wealthfolio/ui/components/ui/select";
import { Skeleton } from "@wealthfolio/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@wealthfolio/ui/components/ui/table";
import { useTranslation } from "react-i18next";

import { RO_TAX_REGIMES, RO_TAX_RULES, writeRegimeToMeta, type RoTaxRegimeId } from "./rules";
import { buildTaxView, toIsoDay, type TaxAccountView, type TaxView } from "./tax-view";

const numberOrNull = (value: string | number | null | undefined): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);

function useTaxView(accounts: Account[]): { view: TaxView | null; isLoading: boolean } {
  const holdingQueries = useQueries({
    queries: accounts.map((account) => ({
      queryKey: [QueryKeys.HOLDINGS, { type: "account", accountId: account.id }],
      queryFn: () => getHoldings({ type: "account", accountId: account.id }),
    })),
  });
  const activitiesQuery = useQuery<ActivityDetails[]>({
    queryKey: [QueryKeys.ACTIVITIES, "ro-tax"],
    queryFn: () => getActivities(),
  });
  const isLoading = activitiesQuery.isLoading || holdingQueries.some((query) => query.isLoading);
  const holdings: Holding[] = holdingQueries.flatMap((query) => query.data ?? []);
  const activities = activitiesQuery.data;

  const view =
    isLoading || !activities
      ? null
      : buildTaxView({
          accounts: accounts.map(({ id, name, meta }) => ({ id, name, meta })),
          holdings: holdings
            .filter((holding) => holding.holdingType === HoldingType.SECURITY && holding.instrument)
            .map((holding) => ({
              accountId: holding.accountId,
              assetId: holding.instrument?.id ?? holding.id,
              symbol: holding.instrument?.symbol ?? holding.id,
              name: holding.instrument?.name ?? null,
              quantity: holding.quantity,
              marketValue: holding.marketValue?.base ?? null,
              costBasis: holding.costBasis?.base ?? null,
            })),
          activities: activities.map((activity) => ({
            accountId: activity.accountId,
            assetId: activity.assetId,
            activityType: activity.activityType,
            date: activity.date,
            quantity: numberOrNull(activity.quantity),
            amount: numberOrNull(activity.amount),
          })),
          asOf: toIsoDay(new Date()),
        });

  return { view, isLoading };
}

function RegimeSelect({ account, view }: { account: Account; view: TaxAccountView }) {
  const { t } = useTranslation();
  const { updateAccountMutation } = useAccountMutations({});
  const onChange = (regime: RoTaxRegimeId | null) => {
    if (!regime) return;
    updateAccountMutation.mutate({
      id: account.id,
      name: account.name,
      group: account.group,
      accountType: account.accountType,
      currency: account.currency,
      isDefault: account.isDefault,
      isActive: account.isActive,
      isArchived: account.isArchived,
      trackingMode: account.trackingMode,
      meta: writeRegimeToMeta(account.meta, regime),
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={RO_TAX_REGIMES.map((regime) => ({
          value: regime,
          label: t(`insights:ro_tax.regime.${regime}.short`),
        }))}
        value={view.regime}
        onValueChange={onChange}
      >
        <SelectTrigger className="h-8 w-[15rem]" aria-label={t("insights:ro_tax.regime_label")}>
          <SelectValue placeholder={t("insights:ro_tax.regime_unset")} />
        </SelectTrigger>
        <SelectContent>
          {RO_TAX_REGIMES.map((regime) => (
            <SelectItem key={regime} value={regime}>
              {t(`insights:ro_tax.regime.${regime}.short`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {view.regimeAssumed && (
        <Badge variant="secondary">{t("insights:ro_tax.regime_assumed")}</Badge>
      )}
    </div>
  );
}

function AccountTaxCard({
  account,
  view,
  currency,
}: {
  account: Account;
  view: TaxAccountView;
  currency: string;
}) {
  const { t } = useTranslation();
  const { formatAmount } = useAmountFormatting();
  const { formatCalendarDate } = useDateFormatting();
  const money = (value: number | null) => (value === null ? "—" : formatAmount(value, currency));
  const signed = (value: number | null) =>
    value === null ? "—" : `${value > 0 ? "+" : ""}${formatAmount(value, currency)}`;
  const range = (low: number | null, high: number | null) =>
    low === null || high === null
      ? "—"
      : Math.abs(low - high) < 0.005
        ? money(low)
        : `${money(low)} – ${money(high)}`;
  const day = (value: string) => formatCalendarDate(value, { dateStyle: "medium" });
  const regime = view.regime;
  const rules = RO_TAX_RULES.regimes;

  let footer: string;
  if (regime === "ro-intermediary") {
    footer = t("insights:ro_tax.footer_intermediary", {
      amount: range(view.taxLow, view.taxHigh),
    });
    if (view.nextLowerRateDate) {
      footer += ` ${t("insights:ro_tax.next_lower_rate", {
        rate: rules["ro-intermediary"].rateLongPct,
        date: day(view.nextLowerRateDate),
      })}`;
    }
  } else if (regime === "self-declared") {
    footer =
      view.unrealizedNet === null
        ? t("insights:ro_tax.footer_unknown_cost")
        : view.unrealizedNet >= 0
          ? t("insights:ro_tax.footer_self_gain", {
              net: signed(view.unrealizedNet),
              rate: rules["self-declared"].ratePct,
              amount: money(view.taxLow),
              date: day(RO_TAX_RULES.deadline),
            })
          : t("insights:ro_tax.footer_self_loss", {
              net: signed(view.unrealizedNet),
              pct: rules["self-declared"].lossCarryForwardPct,
              years: rules["self-declared"].lossCarryForwardYears,
            });
  } else if (regime === "none") {
    footer = t("insights:ro_tax.footer_none");
  } else {
    footer = t("insights:ro_tax.footer_unset");
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AccountIcon meta={account.meta} className="size-7" />
              {account.name}
            </CardTitle>
            {regime && regime !== "none" && (
              <CardDescription>{t(`insights:ro_tax.regime.${regime}.label`)}</CardDescription>
            )}
          </div>
          <RegimeSelect account={account} view={view} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {regime && regime !== "none" && (
          <dl className="divide-border grid divide-y text-sm">
            {(["rate", "who", "losses", "filing"] as const).map((row) => (
              <div key={row} className="grid gap-1 py-2 sm:grid-cols-[9rem_1fr] sm:gap-4">
                <dt className="text-muted-foreground">{t(`insights:ro_tax.rows.${row}`)}</dt>
                <dd>
                  {t(`insights:ro_tax.regime.${regime}.${row}`, {
                    long: rules["ro-intermediary"].rateLongPct,
                    short: rules["ro-intermediary"].rateShortPct,
                    days: rules["ro-intermediary"].longAfterDays,
                    rate: rules["self-declared"].ratePct,
                    pct: rules["self-declared"].lossCarryForwardPct,
                    years: rules["self-declared"].lossCarryForwardYears,
                  })}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {view.positions.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("insights:ro_tax.columns.fund")}</TableHead>
                <TableHead className="text-end">{t("insights:ro_tax.columns.gain")}</TableHead>
                <TableHead>{t("insights:ro_tax.columns.holding")}</TableHead>
                {regime === "ro-intermediary" && (
                  <TableHead className="text-end">{t("insights:ro_tax.columns.tax")}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.positions.map((position) => (
                <TableRow key={position.assetId}>
                  <TableCell className="align-top font-medium">{position.symbol}</TableCell>
                  <TableCell
                    className={`text-end align-top ${
                      position.gain === null
                        ? ""
                        : position.gain < 0
                          ? "text-destructive"
                          : "text-success"
                    }`}
                  >
                    {signed(position.gain)}
                  </TableCell>
                  <TableCell className="align-top">
                    {regime === "ro-intermediary" ? (
                      <ul className="grid gap-1 text-xs">
                        {position.lots.map((lot) => (
                          <li key={lot.date + lot.quantity} className="flex justify-between gap-3">
                            <span className="text-muted-foreground">
                              {t("insights:ro_tax.lot", {
                                quantity: lot.quantity,
                                date: day(lot.date),
                              })}
                            </span>
                            <span>
                              {lot.long
                                ? t("insights:ro_tax.rate_now", {
                                    rate: rules["ro-intermediary"].rateLongPct,
                                  })
                                : t("insights:ro_tax.rate_from", {
                                    rate: rules["ro-intermediary"].rateLongPct,
                                    date: day(lot.longFrom ?? lot.date),
                                  })}
                            </span>
                          </li>
                        ))}
                        {position.undatedQuantity > 1e-9 && (
                          <li className="flex justify-between gap-3">
                            <span className="text-muted-foreground">
                              {t("insights:ro_tax.undated", { quantity: position.undatedQuantity })}
                            </span>
                            <span>
                              {t("insights:ro_tax.rate_either", {
                                long: rules["ro-intermediary"].rateLongPct,
                                short: rules["ro-intermediary"].rateShortPct,
                              })}
                            </span>
                          </li>
                        )}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        {t("insights:ro_tax.holding_irrelevant", { count: position.lots.length })}
                      </span>
                    )}
                  </TableCell>
                  {regime === "ro-intermediary" && (
                    <TableCell className="text-end align-top">
                      {range(position.taxLow, position.taxHigh)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="bg-muted/50 mt-auto rounded-md border p-3 text-sm">{footer}</p>
        {regime && regime !== "none" && (
          <p className="text-muted-foreground text-xs">
            {t(`insights:ro_tax.regime.${regime}.legal`)} {RO_TAX_RULES.regimes[regime].legal}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function RoTaxTab() {
  const { t } = useTranslation();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { view, isLoading } = useTaxView(accounts);
  const { formatAmount } = useAmountFormatting();
  const { formatCalendarDate } = useDateFormatting();
  const currency = accounts[0]?.currency ?? "EUR";
  const ron = (value: number | null) =>
    value === null ? "—" : `${Math.round(value).toLocaleString()} lei`;

  if (accountsLoading || isLoading || !view) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const withPositions = view.accounts.filter((account) => account.positions.length > 0);
  const ifSold =
    view.ifSoldLow === null || view.ifSoldHigh === null
      ? "—"
      : Math.abs(view.ifSoldLow - view.ifSoldHigh) < 0.005
        ? `≈ ${formatAmount(view.ifSoldLow, currency)}`
        : `≈ ${formatAmount(view.ifSoldLow, currency)} – ${formatAmount(view.ifSoldHigh, currency)}`;

  return (
    <div className="grid gap-4 pb-8">
      <p className="text-muted-foreground text-sm">
        {t("insights:ro_tax.intro", {
          year: RO_TAX_RULES.taxYear,
          date: formatCalendarDate(RO_TAX_RULES.retrieved, { dateStyle: "medium" }),
        })}
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>{t("insights:ro_tax.so_far")}</CardDescription>
            <CardTitle className="text-2xl">
              {view.sellsInYear
                ? t("insights:ro_tax.sales", { count: view.sellsInYear })
                : t("insights:ro_tax.none_yet")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {view.sellsInYear
              ? t("insights:ro_tax.so_far_sales")
              : t("insights:ro_tax.so_far_none", { year: view.taxYear })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardDescription>{t("insights:ro_tax.if_sold")}</CardDescription>
              <Badge variant="secondary">{t("insights:ro_tax.illustration")}</Badge>
            </div>
            <CardTitle className="text-2xl">{ifSold}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {t("insights:ro_tax.if_sold_note")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>{t("insights:ro_tax.deadline")}</CardDescription>
            <CardTitle className="text-2xl">
              {formatCalendarDate(RO_TAX_RULES.deadline, { dateStyle: "medium" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {t("insights:ro_tax.deadline_note", {
              year: view.taxYear,
              threshold: ron(view.cassBands[0]?.fromRon ?? null),
            })}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {withPositions.map((accountView) => {
          const account = accounts.find((item) => item.id === accountView.accountId);
          return account ? (
            <AccountTaxCard
              key={account.id}
              account={account}
              view={accountView}
              currency={currency}
            />
          ) : null;
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("insights:ro_tax.distributions_title")}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            {t("insights:ro_tax.distributions_body", { rate: RO_TAX_RULES.dividendRatePct })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("insights:ro_tax.cass_title")}</CardTitle>
            <CardDescription>
              {t("insights:ro_tax.cass_rate", { rate: RO_TAX_RULES.cass.ratePct })}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <p className="text-muted-foreground">{t("insights:ro_tax.cass_body")}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("insights:ro_tax.cass_income")}</TableHead>
                  <TableHead className="text-end">{t("insights:ro_tax.cass_due")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    {t("insights:ro_tax.cass_below", { amount: ron(view.cassBands[0].fromRon) })}
                  </TableCell>
                  <TableCell className="text-end">{t("insights:ro_tax.cass_nothing")}</TableCell>
                </TableRow>
                {view.cassBands.map((band) => (
                  <TableRow key={band.fromRon}>
                    <TableCell>
                      {band.toRon === null
                        ? t("insights:ro_tax.cass_or_more", { amount: ron(band.fromRon) })
                        : `${ron(band.fromRon)} – ${ron(band.toRon - 1)}`}
                    </TableCell>
                    <TableCell className="text-end">{ron(band.dueRon)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-muted-foreground text-xs">
              {t("insights:ro_tax.cass_note", {
                wage: ron(RO_TAX_RULES.minimumGrossWageRon),
                year: view.taxYear,
              })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("insights:ro_tax.lei_title")}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground grid gap-3 text-sm">
            <p>{t("insights:ro_tax.lei_body")}</p>
            <p>{t("insights:ro_tax.unrealized_body")}</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t("insights:ro_tax.sources_title")}</CardTitle>
          <CardDescription>{t("insights:ro_tax.disclaimer")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 text-sm">
            {RO_TAX_RULES.sources.map((source) => (
              <li key={source.url} className="grid gap-0.5">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {source.title}
                </a>
                <span className="text-muted-foreground text-xs">
                  {source.publisher}
                  {source.published
                    ? ` · ${formatCalendarDate(source.published, { dateStyle: "medium" })}`
                    : ""}
                  {` · ${source.usedFor}`}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
