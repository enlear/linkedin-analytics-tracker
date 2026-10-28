# LinkedIn Member Post Analytics — setup (EXPERIMENTAL)

Employee-side automation: each employee connects **their own** LinkedIn account
via OAuth, and the app pulls **their own** post analytics (impressions + reach)
through LinkedIn's official **Member Post Analytics API**
(`memberCreatorPostAnalytics`). No scraping, no shared credentials, no cookies.

The whole feature is **behind a flag and OFF by default**. The Excel upload flow
is unchanged and remains the fallback. Nothing in this feature runs until both
the server flag (`LINKEDIN_API_ENABLED`) and the UI flag
(`NEXT_PUBLIC_FEATURE_LINKEDIN_API`) are set to `true`.

> ⚠️ **You cannot use this without LinkedIn approval.** The Member Post
> Analytics API lives under the **Community Management API (CMA)**, which
> requires a registered legal entity, an app review, and is granted at
> LinkedIn's discretion. Post enumeration additionally needs the **restricted
> `r_member_social`** scope. Until those approvals land, the code is a dormant
> scaffold. See the feasibility study for the full picture.

---

## 1. LinkedIn developer app

1. Create a **registered legal entity** (CMA is not available to individuals).
2. Create an app at <https://developer.linkedin.com/> and link a verified
   Company Page.
3. Request the **Community Management API** product (`My Apps → Products`).
   - CMA **must be the only product on the app** — use a dedicated app, separate
     from the Google-SSO app this project already uses.
   - You start on the **Development tier**: 500 calls/app/24h, 100 calls/member/24h.
4. Separately request the restricted **`r_member_social`** scope (needed to list
   a member's own posts → URN + publish date). If you can't get it, see
   "Hybrid fallback" below.
5. Note your **Client ID** and **Client Secret** (`Auth` tab).
6. Add the **Authorized redirect URL** (`Auth` tab → OAuth 2.0 settings) for
   every origin the app is served from:
   - Local: `http://localhost:3000/connect/linkedin/callback`
   - Prod: `https://<your-domain>/connect/linkedin/callback`

### OAuth scopes requested

```
openid profile r_member_postAnalytics r_member_social
```

- `r_member_postAnalytics` — the metrics (impressions, reach, …). **Core.**
- `r_member_social` — enumerate the member's own posts (URN + publish date).
- `openid profile` — map the LinkedIn member to the app's employee record.

---

## 2. Server environment variables

The connect / sync code runs as Next.js server actions, so its configuration is
ordinary server env vars on your host — `team/.env.local` locally, or your
hosting provider's environment settings (Vercel → Project → Settings →
Environment Variables; Netlify → Site configuration → Environment variables).
Nothing reads them at build time.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `LINKEDIN_API_ENABLED` | yes | off | Master switch. Unless it is exactly `true`, every action answers `disabled`. |
| `LINKEDIN_CLIENT_ID` | yes | — | From the LinkedIn app's `Auth` tab. |
| `LINKEDIN_CLIENT_SECRET` | yes | — | From the LinkedIn app's `Auth` tab. **Secret.** |
| `LINKEDIN_TOKEN_ENC_KEY` | yes | — | 32-byte base64 key that AES-256-GCM encrypts stored tokens. **Secret.** |
| `LINKEDIN_REDIRECT_URI` | no | `<app origin>/connect/linkedin/callback` | Override the OAuth redirect URI. |
| `LINKEDIN_API_VERSION` | no | `202604` | `Linkedin-Version` header (YYYYMM). 202604+ for `LINK_CLICKS` etc. |
| `LINKEDIN_SCOPES` | no | the scopes above | Optional override of the requested scope string. |

Generate the encryption key with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

- Never give the secrets a `NEXT_PUBLIC_` prefix — that would ship them to the
  browser.
- Changing `LINKEDIN_TOKEN_ENC_KEY` makes stored tokens unreadable; every
  connected member has to reconnect.
- The default redirect URI follows the origin the member is using, so one
  deployment works on several domains as long as each is registered with
  LinkedIn. Set `LINKEDIN_REDIRECT_URI` if the app sits behind a proxy that
  rewrites the host, or to pin a single domain.

Example `team/.env.local`:

```
LINKEDIN_API_ENABLED=true
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_TOKEN_ENC_KEY=...
NEXT_PUBLIC_FEATURE_LINKEDIN_API=true
```

---

## 3. UI flag

```
NEXT_PUBLIC_FEATURE_LINKEDIN_API=true
```

This only controls whether the **Connect LinkedIn** card renders on `/upload`.
It is inlined at build time — toggling it requires a rebuild.

Keep the two flags separate on purpose: you can ship the UI to staging while the
server side stays inert, or enable the server side before exposing the UI.

---

## 4. What it does once enabled

- `/upload` shows a **Connect LinkedIn** card with five states: not connected,
  connected, permission missing, fetch failed, fetch successful.
- **Connect** → `getLinkedInAuthUrl()` → LinkedIn consent →
  `/connect/linkedin/callback` (checks the one-time `state` against the
  member's own row, exchanges the code) → stores encrypted tokens.
- **Sync** → `syncLinkedIn(reportMonth)`:
  1. lists the member's own posts (`GET /rest/posts?q=author`),
  2. keeps those whose publish date files them under the report month (day-20
     rule, same as uploads),
  3. fetches lifetime `IMPRESSION` + `MEMBERS_REACHED` per post
     (`GET /rest/memberCreatorPostAnalytics?q=entity`),
  4. writes `post_uploads` rows (`source = 'linkedin_api'`, no post type),
     de-duplicated by post URL against existing uploads — so API and Excel data
     never double-count.
- **Disconnect** clears the stored tokens. Imported posts stay.

The actions live in `src/app/(app)/upload/linkedin-actions.ts`; the LinkedIn
and database logic in `src/lib/linkedin-api/`. Tokens live in
`linkedin_connections` as AES-256-GCM ciphertext. Row-level security lets a
member read their own row, but only the server holds `LINKEDIN_TOKEN_ENC_KEY`,
and the card only ever receives non-secret status fields.

---

## 5. Limits & gotchas

- **Dev tier quota**: 100 calls/member/24h. Each post costs ~2 analytics calls,
  so a single sync covers ~50 posts/member/day. Fine for a monthly assessment.
- **Function time limit**: a sync runs inside one server-action request. Each
  new post takes roughly 0.5–1 s (a de-dup check, two analytics calls, an
  insert), and a throttled call can wait up to 4.5 s in retries — so a month
  with more than ~25 new posts can run past ~25 s, which free hosting tiers
  may not allow. Check your host's limit; on Vercel
  you can raise it with `export const maxDuration = 60` in
  `src/app/(app)/upload/page.tsx` (server actions inherit the page's setting).
  If a sync is cut off, just run it again: posts already imported are skipped
  before any LinkedIn call, so each run picks up where the last one stopped.
- **No engagement rate / post text in analytics** — engagement rate is computed
  on the leaderboard; post text comes from the Posts API `commentary` and is
  stored in `raw_extracted` only.
- **Enumeration cap**: the sync scans up to 6 pages × 50 = 300 most-recent posts.
  If a member has more, the sync result flags `truncated: true` (surfaced in the
  UI) — it does not silently drop posts.
- **Refresh tokens** require LinkedIn approval. Without them, access tokens last
  ~60 days; after that the member must reconnect (the card shows
  "reconnect needed").
- **API versions are sunset monthly** — bump `LINKEDIN_API_VERSION` periodically.

### Hybrid fallback (no `r_member_social`)

If you only get `r_member_postAnalytics`, you can't enumerate posts. Switch to
having employees paste their post URLs (as today's Excel flow already captures),
convert each to a `share`/`ugcPost` URN, and call the analytics `q=entity`
endpoint directly. This needs changes to `src/lib/linkedin-api/sync.ts` (accept
a list of URLs instead of enumerating) — left as a follow-up.
