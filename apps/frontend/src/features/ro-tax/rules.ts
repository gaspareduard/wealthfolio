/**
 * Romanian investment tax rules for a Romanian tax resident, tax year 2026.
 *
 * Research notes, not tax advice. Rates and legal references were checked on
 * 2026-11-01 against the sources below; update this file (and its retrieval date)
 * when the law changes rather than editing the calculation.
 */

export type RoTaxRegimeId = "ro-intermediary" | "self-declared" | "none";

export interface RoTaxSource {
  title: string;
  publisher: string;
  published: string | null;
  url: string;
  usedFor: string;
}

export const RO_TAX_RULES = {
  jurisdiction: "Romania",
  taxYear: 2026,
  retrieved: "2026-11-01",
  /** Minimum gross wage in force on 1 January of the tax year; it sets the CASS bands. */
  minimumGrossWageRon: 4050,
  regimes: {
    "ro-intermediary": {
      rateLongPct: 3,
      rateShortPct: 6,
      longAfterDays: 365,
      legal: "Codul fiscal art. 96^1, art. 97 alin. (8^1)-(8^5), as amended by Legea 239/2025",
    },
    "self-declared": {
      ratePct: 16,
      lossCarryForwardPct: 70,
      lossCarryForwardYears: 5,
      legal: "Codul fiscal art. 96, 119 and 123 alin. (12), as amended by Legea 239/2025",
    },
  },
  dividendRatePct: 16,
  dividendLegal: "Codul fiscal art. 97 alin. (7), as amended by Legea 141/2025",
  cass: {
    ratePct: 10,
    bands: [
      { fromWages: 6, toWages: 12, baseWages: 6 },
      { fromWages: 12, toWages: 24, baseWages: 12 },
      { fromWages: 24, toWages: null, baseWages: 24 },
    ],
    legal: "Codul fiscal art. 170 alin. (2)-(4)",
  },
  /** Declaratia unica for the tax year. */
  deadline: "2027-05-25",
  sources: [
    {
      title:
        "ANAF (DGRFP Brasov): Modificari aduse Codului fiscal prin Legea nr. 239/2025 - impozitul pe venit si contributiile sociale",
      publisher: "ANAF",
      published: "2026-01-29",
      url: "https://static.anaf.ro/static/10/Brasov/Brasov/web_ian_2026.pdf",
      usedFor:
        "3% / 6% intermediary rates, 16% self-declared rate, 16% dividends, 2026 CASS bases and minimum wage",
    },
    {
      title:
        "XTB: Intrebari frecvente despre regimul fiscal aplicabil incepand cu 1 ianuarie 2026 (with BDO Romania)",
      publisher: "XTB S.A. Varsovia Sucursala Bucuresti",
      published: null,
      url: "https://xas-new-cdn.xtb.com/file/0102/11/b2740d80-4ad9-4a19-8b51-dc4f881cb000/faq-venituri-din-investitii.pdf",
      usedFor:
        "Branch status, final withholding, FIFO holding period, weighted-average cost, loss treatment, CASS amounts",
    },
    {
      title: "Codul fiscal (Legea 227/2015), consolidated text",
      publisher: "ANAF",
      published: null,
      url: "https://static.anaf.ro/static/10/Anaf/legislatie/Cod_fiscal_norme_2023.htm",
      usedFor:
        "Art. 96, 119 (70% / 5-year loss carry-forward), 123 alin. (12), 97 alin. (7). Its art. 97 alin. (8^1) still showed the 2025 rates when read.",
    },
    {
      title: "Ziarul Financiar: Ce impozite vor plati de la 1 ianuarie 2026 investitorii",
      publisher: "Ziarul Financiar",
      published: "2025-12-20",
      url: "https://www.zf.ro/burse-fonduri-mutuale/bursa-impozite-vor-plati-1-ianuarie-2026-investitorii-tranzactii-22984186",
      usedFor: "Secondary confirmation; CASS measured on gross gain via Romanian intermediaries",
    },
  ] satisfies RoTaxSource[],
} as const;

/** Where an account's tax regime is stored inside its `meta` JSON. */
export const RO_TAX_META_KEY = "roTax";

export const RO_TAX_REGIMES: RoTaxRegimeId[] = ["ro-intermediary", "self-declared", "none"];

export function readRegimeFromMeta(meta?: string | null): RoTaxRegimeId | null {
  if (!meta?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(meta);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const entry = (parsed as Record<string, unknown>)[RO_TAX_META_KEY];
    const regime =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>).regime : undefined;
    return RO_TAX_REGIMES.includes(regime as RoTaxRegimeId) ? (regime as RoTaxRegimeId) : null;
  } catch {
    return null;
  }
}

/** `meta` with the regime stored under its own key; every other entry is kept. */
export function writeRegimeToMeta(meta: string | null | undefined, regime: RoTaxRegimeId): string {
  let object: Record<string, unknown> = {};
  if (meta?.trim()) {
    try {
      const parsed: unknown = JSON.parse(meta);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        object = parsed as Record<string, unknown>;
      }
    } catch {
      object = {};
    }
  }
  return JSON.stringify({ ...object, [RO_TAX_META_KEY]: { regime } });
}

/**
 * A starting guess from the account or broker name, shown as an assumption until
 * the user confirms it: XTB clients who opened their account through the
 * Bucharest branch get Romanian withholding; IBKR has no Romanian intermediary
 * branch known. Anything else is left unset.
 */
export function guessRegime(name: string): RoTaxRegimeId | null {
  const value = name.toLowerCase();
  if (/\bxtb\b|x-trade/.test(value)) return "ro-intermediary";
  if (/\bibkr\b|interactive brokers/.test(value)) return "self-declared";
  return null;
}
