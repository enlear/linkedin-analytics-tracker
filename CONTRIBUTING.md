# Contributing

Thanks for helping! The app lives in [`personal/`](personal): a Next.js app exported as a static
site, with SheetJS for reading `.xlsx`, Recharts for charts and IndexedDB for storage. You only
need Node.js 20+.

```bash
git clone https://github.com/<your-fork>/linkedin-analytics-tracker.git
cd linkedin-analytics-tracker/personal
npm install
npm run dev        # http://localhost:3000 — click "Try it with demo data"
npm test
```

## Ground rules

1. **No real data in the repo.** `*.xlsx` and `*.csv` are git-ignored on purpose. Tests build
   synthetic workbooks in code; see `personal/test/fixtures/small-export.ts` and
   `personal/src/lib/linkedin/build-export.ts`.
2. **Never send user data over the network.** No analytics, no CDNs, no external fonts. The
   production Content-Security-Policy (`connect-src 'self'` in `personal/src/app/layout.tsx`)
   enforces this; don't loosen it.
3. **Small, focused PRs**, one change each.
4. Before opening a PR, run `npm run lint && npm run typecheck && npm test` in `personal/`. CI
   runs the same checks plus a production build.

## Common contributions

### "My export doesn't parse"

The parser (`personal/src/lib/linkedin/parse-export.ts`) finds each section by **header text**,
listed in `LABELS`. To support another language or a renamed column:

1. Add the label, in lower case, to the right list in `LABELS`.
2. Add a test to `personal/test/parse-export.test.ts` that builds a workbook with that label and
   checks it parses.

### A new chart or insight

Put the calculation in `personal/src/lib/insights.ts` as a pure function with a unit test, then
render it in `personal/src/components/dashboard/`. Charts use a single colour (`--primary`), have
a hover tooltip, and never use two y-axes.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix(parser): …`,
`docs: …`, `test: …`.
