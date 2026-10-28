# Contributing

Thanks for helping! The repository holds two independent Next.js apps. You only need Node.js 20+.

| Folder | What it is | Stack |
|---|---|---|
| [`personal/`](personal) | Browser-only dashboard, exported as a static site | SheetJS for `.xlsx`, Recharts, IndexedDB |
| [`team/`](team) | Self-hosted team tracker | Supabase (Postgres with row-level security, Auth, Storage), server actions, SheetJS, Recharts |

```bash
git clone https://github.com/<your-fork>/linkedin-analytics-tracker.git
cd linkedin-analytics-tracker/personal     # or team
npm install
npm test
npm run dev        # http://localhost:3000
```

- **Personal:** click *Try it with demo data* to see the dashboard without an export.
- **Team:** `npm test` needs no Supabase project. To click through the app you need a free
  Supabase project and `team/.env.local`; `npm run setup -- team` from the repository root sets
  both up (see [team/docs/setup.md](team/docs/setup.md)).

## Ground rules

1. **No real data in the repo.** `*.xlsx` and `*.csv` are git-ignored on purpose. Tests build
   synthetic workbooks in code; see `personal/test/fixtures/small-export.ts`,
   `personal/src/lib/linkedin/build-export.ts` and `team/test/company-import/fixtures.ts`. No real
   names, emails, post URLs or numbers in tests, seed data or screenshots either.
2. **Personal: never send user data over the network.** No analytics, no CDNs, no external fonts.
   The production Content-Security-Policy (`connect-src 'self'` in `personal/src/app/layout.tsx`)
   enforces this; don't loosen it.
3. **Team: the database is the access control.** The app runs every query as the signed-in user,
   so a new table needs row-level security policies in a migration and a test for them in
   `team/test/db/`. Never use Supabase's secret (service role) key in the app.
4. **Small, focused PRs**, one change each.
5. Before opening a PR, run `npm run lint && npm run typecheck && npm test` in the folder you
   changed. CI runs the same checks plus a production build for both apps.

## Common contributions

### "My export doesn't parse"

The personal parser (`personal/src/lib/linkedin/parse-export.ts`) finds each section by **header
text**, listed in `LABELS`. To support another language or a renamed column:

1. Add the label, in lower case, to the right list in `LABELS`.
2. Add a test to `personal/test/parse-export.test.ts` that builds a workbook with that label and
   checks it parses.

The team app has its own parsers for single-post exports (`team/src/lib/linkedin/`) and company
page exports (`team/src/lib/company-import/`), each with tests in `team/test/`.

### A new chart or insight

**Personal:** put the calculation in `personal/src/lib/insights.ts` as a pure function with a
unit test, then render it in `personal/src/components/dashboard/`.

**Team:** keep calculations in `team/src/lib/` (scoring and periods live in `period.ts`) with a
unit test, and read data through `team/src/lib/data/`.

Personal charts use a single colour (`--primary`), have a hover tooltip, and never use two
y-axes. Team charts follow the existing ones in `team/src/components/` and
`team/src/app/(app)/company/`.

### A database change (team)

1. Add a **new** file to `team/supabase/migrations/`, named with a later timestamp. Never edit a
   migration that has already been released: people have already run it.
2. Make it safe to run twice (`if not exists`, `create or replace`, `drop policy if exists`).
3. Add or update the matching types in `team/src/lib/supabase/database.types.ts`.
4. Test the policies in `team/test/db/schema.test.ts`. The tests run every migration in PGlite,
   so no Supabase project is needed.
5. Say in the PR description that the migration has to be run. Users apply it in their SQL Editor.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat: …`, `fix(parser): …`,
`feat(team): …`, `docs: …`, `test: …`.
