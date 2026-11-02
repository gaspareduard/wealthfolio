# Folio fork

A personal fork of [Wealthfolio](https://github.com/wealthfolio/wealthfolio) for
a Romanian tax resident investing through XTB and IBKR. It adds six things on
top of upstream and changes nothing else.

| Addition                                                                              | Where                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Insights → Taxes**: the Romanian tax view of current holdings                       | `apps/frontend/src/features/ro-tax/`                   |
| **Insights → Brokers**: how value and cost basis are split between accounts over time | `apps/frontend/src/features/broker-split/`             |
| **Folio theme**, the default for new profiles                                         | `apps/frontend/src/themes/definitions/folio.css`       |
| **Account icons**: a broker logo beside the account name                              | `apps/frontend/src/features/account-icon/`             |
| **Cat profile avatars**: a pink and a blue cat in a Cats group of the avatar picker   | `apps/frontend/src/features/profiles/cat-avatars.tsx`  |
| **Profile pictures**: upload your own square picture as a profile avatar              | `apps/frontend/src/features/profiles/custom-avatar.ts` |

## Taxes tab

Research notes for tax year 2026, not tax advice. Each account gets a regime,
saved in the account's `meta` JSON under `roTax`:

- **Romanian intermediary** (for example XTB's Bucharest branch): 3% of the gain
  on units held at least 365 days, 6% otherwise, withheld per sale and final.
  Holding periods are rebuilt first in, first out from the BUY/SELL activities.
  Losses do not offset anything.
- **Self-declared** (for example IBKR): 16% of the year's net gain, declared in
  the Declarația unică. A net loss carries forward 5 years, up to 70% of each
  later year's gain.
- **Not taxed in Romania**.

Until a regime is saved, XTB and IBKR accounts show a guess from their name,
marked as assumed. The "if sold today" figures are illustrations in the base
currency; the real tax is computed in lei at BNR rates per transaction. The tab
also lists the CASS bands for the year.

Rates, legal references and sources live in `ro-tax/rules.ts`, with their
retrieval date. When the law changes, update that file and its sources rather
than the calculation.

## Account icons

An account can carry its own icon: a PNG data URL (at most 150 KB, the asset
logo limit) in its `meta` JSON under `icon`. The dashboard account rows, the
account page title and the Brokers and Taxes tabs draw it beside the account
name; accounts without one look as before. Funds use Wealthfolio's own custom
asset logos. The owner's tracker sets both.

## Cat avatars

Two original round cats with a nub tail, pink and blue, drawn in SVG (no image
files). Their IDs, `folio-cat-pink` and `folio-cat-blue`, are added to the
backend allowlist in `crates/core/src/profiles/mod.rs`. They blink and wiggle
the tail unless reduced motion is on.

## Profile pictures

Besides the bundled avatars, a profile can use its own picture: **Upload
picture** in the avatar picker keeps the centre square of the chosen image and
scales it to a PNG of at most 192 pixels and 64 KB in the browser. The picture
is stored inline in the profile registry as its `avatarId` (a PNG data URL); the
backend accepts it only as a square PNG of at most 256 pixels and 64 KB
(`is_custom_avatar` in `crates/core/src/profiles/mod.rs`). Pictures live only on
the installation that holds them, never in this repository or its image.

On the self-hosted server, every uploaded picture is also kept in a **Gallery**
group shown first in the picker, so any profile can choose it later. The gallery
is the `avatar-gallery/` folder beside the server database (one `<sha256>.png`
per picture, at most 32), reached through the profile commands
`list_avatar_gallery`, `save_avatar_to_gallery` and
`remove_avatar_from_gallery`. They need the server login, like the other profile
commands.

## Branches and image

- `folio/main` is the deployment branch: the fork commits on top of the latest
  upstream release tag (currently `v3.12.0`).
- `main` stays at the fork point. Pushing upstream commits to it would start
  upstream's `cache-warm.yml` in this fork, so leave it alone.
- Pushing `folio/main` runs `.github/workflows/folio-image.yml`: Rust checks,
  then a linux/amd64 build that is smoke-tested and pushed to the package
  `ghcr.io/gaspareduard/wealthfolio` as `folio-<short sha>` and `folio`. GHCR
  made the package public because this fork is public; it holds only this fork's
  code, never portfolio data. Changes to Markdown files alone skip the build.
  Deployments pin the `folio-<short sha>` tag.

To take a new upstream release, fetch its tag and rebase the fork commits onto
it (`git rebase --onto vX.Y.Z <previous tag> folio/main`), run the checks below,
push with `--force-with-lease`, and move the deployment to the new image tag.
Back up the database first: upstream releases can include migrations.

## Checks

From the repository root, with the Node version in `.node-version`:

```bash
pnpm format:check
pnpm --filter frontend i18n:check
pnpm themes:check
pnpm type-check
pnpm --filter frontend exec vitest run src/features
```

The new strings are English in every locale.
