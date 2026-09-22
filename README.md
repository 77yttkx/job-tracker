# Job Tracker

A job application tracker with private, per-user workspaces. Sign in (or
create an account) with your email and password, and everything you do -
adding, importing, editing, and viewing applications - is scoped to you
alone: paste a job posting URL, let the app try to pull out the company,
role, location, description, sponsorship signal, and posted date via a
server-side parser, then manage every application from an Insights page
and a filterable table that only ever show your own jobs.

## Features

- **Authentication (Supabase Auth, email + password)** - sign up, sign in,
  sign out, and forgot/reset password, each a polished dedicated screen
  (`src/pages/auth/`). The app requires a session before showing any job
  data at all, and the signed-in session persists across a page refresh.
  Every application is private to the account that created it: two
  different people signed in on the same deployment never see, edit, or
  export each other's jobs - enforced by Postgres Row Level Security, not
  just the UI (see "Multi-user security model" below). No social login,
  since none is configured for this project.
- **URL parsing (server-side)** - paste a job posting URL and a Supabase
  Edge Function (`parse-job`) fetches and parses it server-side, avoiding
  browser CORS restrictions and any public CORS proxy. Layered extraction:
  provider-specific handling for common ATS platforms (Greenhouse, Lever,
  Workday, Ashby, SmartRecruiters, iCIMS, Jobvite, Phenom/custom enterprise
  sites), then embedded structured data (JSON-LD `JobPosting`, embedded
  JSON app state, Open Graph/meta tags), then a semantic HTML fallback
  (title, headings, description containers, labeled location fields).
  Every field stays editable, and a failed or partial parse never blocks
  manually creating the record.
- **Sponsorship classification** - a conservative, text-based read of the
  job description: `No` only for explicit no-sponsorship language, `Yes`
  only for explicit positive language, `Unknown` whenever it's absent,
  ambiguous, contradictory, or parsing failed. Always manually editable.
- **Location extraction** - pulled from structured job data, ATS-specific
  fields, metadata, and visible page labels (e.g. "Charlotte, NC, United
  States", "Remote — United States"). Never invented; always editable.
- **Insights page** (the default/landing page) - a global, always-on
  overview with **no filter bar of its own**: every number and chart here
  is always calculated from *all* of your jobs (never another user's -
  see "Multi-user security model" below), and never reacts to the Table
  page's filters. Filtering exists only on the Table page.
  - **Application overview** (the first panel, directly below the page
    title) - a plain, accurate snapshot built only from each job's
    *current* `status`, with **no inference** about stages a job may have
    passed through: a prominent Total applications card, plus a
    responsive horizontal Recharts bar chart showing every one of the 8
    statuses in fixed pipeline order (`Applied` -> `OA` -> `1st Round` ->
    `2nd Round` -> `Final Round` -> `Offer` / `Rejected` / `Ghosted`),
    each with its exact count and percentage of the total - a status with
    zero jobs is still shown as an explicit `0 (0%)` bar rather than being
    omitted.
  - Application time summary: today / this week / this month, plus a line
    chart with a Day (last 30 days) / Week (last 12 Mon-Sun weeks) / Month
    (last 12 months) granularity toggle, with zero-value buckets so the
    trend stays continuous. Jobs with no `applied_date` count toward every
    other total but are excluded from these date-based counts and chart.
  - Status distribution (count + % of total, all 8 exact statuses, same
    underlying numbers as the application overview above but as a compact
    list). There is deliberately no sponsorship distribution panel on
    Insights.
  - Loading, error (with a Retry action), and empty states are distinct:
    "No applications yet" is only ever shown after a query that succeeded
    and genuinely returned zero rows, never while loading or after a
    failed/misconfigured query - see Troubleshooting below.

  > **V2.5.2 note:** the Sankey/funnel diagram that previously led this
  > page was removed entirely, not fixed. It inferred that a job in a
  > later stage had already passed through every earlier stage on the
  > principal path - something this app cannot actually know, since the
  > database stores only each job's current status, not a history of
  > status changes - and its Recharts tooltip had a visible
  > "undefined -> undefined" bug. The application overview above replaced
  > it: every number on it comes directly from `job.status` values
  > currently in the database, nothing is inferred.
- **Table view - the only page with filters**: free-text search across
  company/role/JD/URL/notes, plus dedicated Company (text) / Status
  (multi-select) / Sponsorship (multi-select) filters that combine with
  AND logic (e.g. company contains "Moody" AND status is Applied or OA AND
  sponsorship is No), an applied-date range filter, sort by
  applied/updated date, a visible "Clear filters" action, location and
  sponsorship columns, and edit/delete (with inline confirmation).
- **Import jobs (CSV/Excel)** - on the Table page, next to Export CSV.
  Reads `.csv`, `.xlsx`, and `.xls` files entirely client-side (via
  SheetJS/`xlsx` - nothing is uploaded to a third party). Lets you pick a
  worksheet (if the file has more than one), auto-matches spreadsheet
  columns to Job Tracker fields (with manual override), and shows a full
  preview - counts of valid/duplicate/invalid/blank rows - before anything
  is saved. Normalizes status and sponsorship values, converts Excel date
  serials and common date text to `YYYY-MM-DD`, skips blank rows, and
  skips duplicate `job_url` values (both within the file and against what
  is already in the database) rather than overwriting anything. A row with
  only a job URL is importable; you can optionally have it call the
  existing `parse-job` Edge Function afterward (2-3 requests at a time) to
  fill in *only the blank* company/role/description/location/sponsorship
  fields - a failed lookup never loses the row, it's just flagged for
  manual review. Capped at 200 rows per import, with a downloadable CSV
  error report for anything invalid, skipped, or flagged.
- **CSV export** - exports every one of *your* stored jobs (not just
  filtered Table rows, and never another user's - RLS scopes the
  underlying query, see "Multi-user security model" below) with RFC
  4180-correct escaping, columns in the required order (including
  `location` and `sponsorship`), and a
  `job-tracker-export-YYYY-MM-DD.csv` filename.
- **English dates everywhere, including date inputs** - every displayed
  date (table cells, Insights labels, chart tooltips) is formatted with the
  `en-US` locale explicitly, rather than the browser's default locale, so
  dates render in English (e.g. "Sep 21, 2026") no matter what language the
  browser/OS is set to. `applied_date` is still stored as plain
  `YYYY-MM-DD`, and every date-only value is parsed as a local calendar
  date (never through a UTC-interpreting `new Date("YYYY-MM-DD")`) to avoid
  an off-by-one-day shift. Date *inputs* (Add/Edit Job's Applied date, and
  the Table's Applied from/to filters) are a custom `DateField` component
  (`src/components/ui/DateField.tsx`), not the native
  `<input type="date">` - Chrome/macOS localizes that native control's
  displayed text (not just its calendar popup) to the OS locale, which is
  what rendered as Chinese `年/月/日` before this change. `DateField` always
  shows/accepts `MM/DD/YYYY`, validates real calendar dates (rejecting e.g.
  `02/30/2026`), and includes its own small English calendar popup, with no
  native locale dependency anywhere in the date-entry path.
- **Light/dark theme** - respects system preference on first load, then
  persists your choice in `localStorage`.
- **Responsive** - a compact desktop/tablet sidebar (nav, Add Job, and the
  dark-mode toggle) stays pinned to the viewport height while the main
  column - e.g. a long Table list - scrolls independently underneath it;
  mobile keeps its own bottom nav bar instead. The Table scrolls
  horizontally on small screens, filters remain reachable there, and the
  Import modal is scrollable/usable on a phone screen.

> **V2 note:** the Kanban board from the original MVP has been removed and
> replaced by the Insights page as the landing page, per the V2 spec. Status
> is still fully editable (in the Add/Edit modal and via the Table), just
> not via drag-and-drop between columns.

## Tech stack

React 18 + TypeScript + Vite, Tailwind CSS, Supabase (Postgres + Auth +
Edge Functions), React Router, Recharts (bar + line charts), `xlsx`
(SheetJS, for CSV/Excel import - loaded lazily, only when the Import modal
opens), Lucide React (icons), Vitest (unit tests).

## Local setup

```bash
npm install
cp .env.example .env
# fill in .env - see "Supabase setup" below
npm run dev
```

The app runs at http://localhost:5173 by default.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run **one** of:
   - `supabase-schema.sql` - for a brand-new database. Creates the
     `public.jobs` table already including `location`/`sponsorship`, the
     exact status enum (mirrored in `src/lib/constants.ts`), the
     `updated_at` trigger, indexes, and development-appropriate RLS
     policies.
   - `supabase-v2-migration.sql` - for an **existing V1 database** you
     already ran `supabase-schema.sql` on. It's additive only: it adds the
     `sponsorship` (`not null default 'Unknown'`, checked to `Yes`/`No`/
     `Unknown`) and `location` (nullable) columns without dropping or
     recreating the table, and existing rows are preserved as-is
     (`sponsorship = 'Unknown'`, `location = null`).
   - `supabase-v2_5_1-migration.sql` - for an **existing V2/V2.5 database**
     (one that still has the old `'Reject'` status value in its
     `jobs_status_check` constraint). Converts any existing `status =
     'Reject'` rows to `'Rejected'` first, then replaces the constraint to
     require `'Rejected'` instead of `'Reject'` - safe to run more than
     once, and safe to run even if you have zero rows. A brand-new
     `supabase-schema.sql` already uses `'Rejected'`, so you only need this
     if your project predates V2.5.1.
3. **Then run `supabase-v2_6-multi-user.sql` - required, on every database,
   even a brand-new one you just created with `supabase-schema.sql`.** It
   adds the `user_id` column, enables/re-affirms Row Level Security, drops
   the old single-user `anon`-accessible policies, and creates the
   per-user `select`/`insert`/`update`/`delete` policies described in
   "Multi-user security model" below. **Do not skip this step and do not
   import or re-create any job data before running it** - until it runs,
   the database is still in single-user "anyone with the anon key can read
   everything" mode.
4. In Project Settings -> API, copy the Project URL and the `anon`/
   `publishable` public key into `.env`:

   ```env
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Configure Supabase Auth - see "Authentication setup" immediately below.
6. Deploy the `parse-job` Edge Function (see below) so URL parsing works.

### Authentication setup

Supabase Auth is enabled by default on every Supabase project - there is no
separate "turn it on" step. In your project's dashboard, under
**Authentication**:

1. **Providers -> Email**: leave Email enabled (it is by default). This app
   only uses email + password; no other provider needs to be configured.
2. **Providers -> Email -> "Confirm email"**: your choice.
   - **On** (Supabase's default): after Sign up, a new user must click a
     confirmation link in their email before they can sign in. The app's
     Sign up screen already shows a "Check your email" message for this
     case.
   - **Off**: a new user is signed in immediately after Sign up, no email
     round-trip. Simpler for local development/testing (e.g. with your
     boyfriend's or a friend's account) if you'd rather not depend on
     transactional email deliverability while testing.
3. **URL Configuration -> Site URL**: set this to wherever the app is
   actually reachable - `http://localhost:5173` for local dev, or your
   Vercel/production URL once deployed (see "Suggested deployment" below).
   This is the base URL Supabase uses when it can't otherwise infer where
   to send someone back to.
4. **URL Configuration -> Redirect URLs**: add `<your-site-url>/reset-password`
   (e.g. `http://localhost:5173/reset-password`, and again for your
   production URL once you deploy) - this is the page the "forgot
   password" email link sends the user to, and Supabase rejects a redirect
   to any URL not on this allow-list. Add both your local and production
   URLs here; you can have more than one.
5. Nothing else needs configuring for this MVP - password strength/length
   uses Supabase Auth's own default minimum (6 characters, mirrored by
   `MIN_PASSWORD_LENGTH` in `src/lib/authValidation.ts` so the sign-up
   form's client-side check never drifts from what the server actually
   enforces), and no custom email templates are required (Supabase's
   default confirmation/reset emails work fine).

### Deploying the `parse-job` Edge Function

The Edge Function lives at `supabase/functions/parse-job/`. Its parsing
logic lives in `supabase/functions/_shared/parsing/` - **not** under
`src/`, and imported with explicit `.ts` extensions - because the Supabase
Edge Function bundler only includes files inside `supabase/functions/`; an
import reaching outside it (e.g. into `src/lib/...`) fails to bundle at
deploy time with a "Module not found" error. `src/lib/parsing/*.ts` are
thin re-exports of that same shared code, so the frontend unit tests still
exercise the exact logic that runs in production.

```bash
# one-time: install the Supabase CLI and log in
npm install -g supabase
supabase login

# link this repo to your Supabase project (find <project-ref> in the
# project's dashboard URL or Project Settings -> General)
supabase link --project-ref <project-ref>

# deploy the function - --no-verify-jwt is required (see below)
supabase functions deploy parse-job --no-verify-jwt
```

**`--no-verify-jwt` is required, and is not a security downgrade.** V2.6
made this function require a signed-in caller, but Supabase's own
platform-level JWT gate (what `verify_jwt = true`, the default, checks)
can't reliably tell an anon-key-only call apart from a real user session
once a project uses the newer `sb_publishable_.../sb_secret_...` API key
format (as this project's `.env` does) rather than the older JWT-format
keys. So the function does its own explicit check instead
(`getAuthenticatedUserId` in `supabase/functions/parse-job/index.ts`): it
reads the caller's `Authorization` header and calls Supabase Auth's own
`auth.getUser(token)` with it - a real session token resolves to a user, an
anon-key-only call resolves to none and gets a `401`. `--no-verify-jwt`
turns off the platform gate so this in-function check is the one that
actually runs (with it left on, the platform could reject a legitimate
signed-in call before the function's own, more reliable check ever runs).

No frontend call-site changes were needed for this: `supabase.functions
.invoke('parse-job', { body: { url } })` (`src/services/jobParser.ts`)
already automatically sends `Authorization: Bearer <session.access_token>`
when the caller has an active session, and the app only ever renders the
UI that calls this function while signed in (see `src/App.tsx`) - so every
real call already carries a valid session token.

To sanity-check that everything the function imports resolves correctly
*before* deploying (useful if you edit the parsing modules), you can run
Deno's own module/type checker locally - the same class of check Supabase's
bundler performs:

```bash
npx deno check supabase/functions/parse-job/index.ts
```

No secrets are required by the function itself beyond its own
`SUPABASE_URL`/`SUPABASE_ANON_KEY` - both auto-provided to every Edge
Function by the Supabase platform - and it never needs the service-role
key. It makes plain outbound HTTP requests only to the job URL the caller
supplies.

To run/test it locally instead: `supabase functions serve parse-job --no-verify-jwt`.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Your Supabase anon (public) API key. |
| `VITE_CORS_PROXY_URL` | No | Unused in V2. URL parsing now runs entirely through the server-side `parse-job` Edge Function, so no browser CORS proxy is needed. Kept out of `.env.example` intentionally; safe to remove from any existing `.env`. |

### URL parsing limitations

`parse-job` is a best-effort parser, not a general-purpose scraper:

- Sites that require authentication, sit behind a CAPTCHA, or render their
  job content entirely client-side with JavaScript (so the initial
  server-fetched HTML has no job data in it) will not parse successfully.
  In practice this includes some modern ATS front ends that hydrate content
  after page load — the function only sees the static HTML a plain
  server-side `fetch` returns, the same as any bot that doesn't execute
  JavaScript.
- Extraction quality depends on what the page publishes in provider-specific
  markup, JSON-LD/embedded JSON, or Open Graph/meta tags; some fields may
  come back empty even on a page that loads fine.
- The function validates and rejects unsafe targets before fetching:
  non-`http(s)` URLs, `localhost`/private/link-local IP ranges, and known
  cloud metadata addresses (e.g. `169.254.169.254`), including after
  following a redirect - this is an SSRF guard, not a parsing feature.
- A failed or partial parse never blocks creating the record - all fields,
  including sponsorship and location, remain manually editable before and
  after saving. The modal shows which fields were extracted and which need
  manual entry.
- **Moody's test URL:** `https://careers.moodys.com/en/job/charlotte/data-analyst-summer-intern/49841/100453454224`
  was used as the spec's required test case during development. The static
  HTML of that specific real page does not currently contain an explicit
  sponsorship statement, so the correct, verified result for it is
  `sponsorship: "Unknown"` (never guessed as "No" or "Yes" without explicit
  language). The sponsorship *classifier* itself is separately covered by a
  unit test asserting the spec's exact example sentence ("We are unable to
  sponsor or take over sponsorship of employment visas at this time.")
  classifies as `No`.

## Troubleshooting

### Insights says "No applications yet" but Table has data

Insights and Table read from the exact same place: `App.tsx` calls
`useJobs(userId)` **once**, inside the signed-in `AuthenticatedApp`
subtree, and passes that single `jobsState` down to both pages as a prop
(see `src/hooks/useJobs.ts` / `src/App.tsx` and the regression test
`src/__tests__/sharedJobsSource.test.ts`, which fails the build if a
future change ever gives one page its own separate `useJobs()` call).
Because of that, "No applications yet" is only ever rendered once loading
has finished *and* the query did not error - i.e. after a request that
genuinely succeeded and returned zero rows (`src/pages/InsightsPage.tsx`).
If you saw the two pages disagree, it was one of these, roughly in order
of likelihood:

1. **A stale dev server after editing `.env`.** Vite reads `VITE_*`
   variables at server start; editing `.env` while `npm run dev` is still
   running does not take effect until you stop and restart it.
2. **You ran `supabase-v2_6-multi-user.sql` before creating your
   account, and your existing jobs are legacy `user_id IS NULL` rows.**
   As of V2.6, RLS filters every `select` to `user_id = auth.uid()` - a
   row with no owner matches no signed-in user's policy and simply never
   appears, for anyone, which looks identical to "the table is empty" from
   the UI. See "Legacy rows with `user_id IS NULL`" inside
   `supabase-v2_6-multi-user.sql` for the (deliberately manual, opt-in) SQL
   to assign them to your account.
3. **RLS silently filtering out every row on `select`, but not on
   `insert`.** Postgres Row Level Security does not distinguish "denied"
   from "genuinely empty" for a `select` - a policy mismatch returns `200`
   with an empty array, not an error, which is indistinguishable from a
   truly empty table at the network level. Confirm in Supabase's dashboard
   (Authentication -> Policies, on `public.jobs`) that the four
   `to authenticated using/with check (user_id = auth.uid())` policies from
   `supabase-v2_6-multi-user.sql` exist and are enabled, and that no old
   `dev anon select`-style policy was left behind (it would need to be
   dropped, not just superseded - RLS grants access if *any* policy on the
   table allows it).
4. **A mismatched or half-configured `.env`.** Confirm `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY` in `.env` are both from the *same*
   Supabase project, and that the key is the `anon`/`publishable` key (not
   the `service_role`/`secret` key, which must never be used in the
   frontend).
5. **A genuine, transient query error** that happened to occur while you
   were on Insights but not when you next loaded Table (e.g. a brief
   network blip). This case is now visibly different from "zero rows": any
   failed query shows the red error state with a **Try again** button and,
   when the underlying error carried one, a small line of extra detail
   (the Postgres/PostgREST error code and hint) beneath the message -
   never a silent "No applications yet" (`src/services/jobs.ts`'s
   `SupabaseQueryError`, surfaced via `src/hooks/useJobs.ts`).

If Insights and Table still ever show a different job count after ruling
out the above, that is a real regression - please file an issue with the
error state's detail line (if one was shown) and whether a hard browser
refresh changes anything.

### Signed in, but the app still shows "Sign in required to parse job URLs"

The `parse-job` Edge Function itself checks for a signed-in caller (see
"Deploying the `parse-job` Edge Function" above) - if you deployed it
before running `supabase functions deploy parse-job --no-verify-jwt`
(i.e. without that flag, or before this V2.6 change), redeploy with the
flag included.

## Running tests, linting, and type checking

```bash
npm run test       # vitest, run once
npm run test:watch # vitest, watch mode
npm run lint        # eslint
npx tsc -b          # type check (also run automatically by `npm run build`)
```

Parser and SSRF-safety tests run entirely against stored HTML fixtures
(`src/lib/parsing/__tests__/fixtures/`) - none of the test suite depends on
reaching a live external career site.

## Building for production

```bash
npm run build    # type-checks, then builds to dist/
npm run preview  # serve the production build locally
```

## Pushing to GitHub

This repo is safe to push publicly as of V2.6 - see "Multi-user security
model" below for what that claim actually rests on. `.gitignore` already
excludes `.env`/`.env.*` (everything except the variable-names-only
`.env.example`), `node_modules`, `dist`, TypeScript build info, local
Supabase CLI state (`.supabase/`, `supabase/.temp/` - the latter holds a
plaintext Postgres connection string for whichever project you last
`supabase link`ed), and leftover folders/archives from earlier
development (`_to_delete/`, `*-before-*/`, `*.tar.gz`).

```bash
git init
git add -A
git status   # sanity check - see below
git commit -m "Job Tracker: multi-user Supabase app"

# create a new repo on GitHub first (via github.com or `gh repo create`),
# then:
git remote add origin git@github.com:<you>/<repo-name>.git
git branch -M main
git push -u origin main
```

Before that first push, skim `git status`/`git add -A`'s output once for
anything that looks like it shouldn't be there (a stray `.env`, a database
dump, a screenshot with personal data in it) - `.gitignore` covers every
file this project itself creates, but it can't protect against something
you add by hand later.

## Suggested deployment (Vercel)

Any static host that can serve a Vite build works (Vercel, Netlify,
Cloudflare Pages, static S3 + CDN, etc.); Vercel is the most direct path
since it can build straight from the GitHub repo above.

1. On [vercel.com](https://vercel.com), **Add New -> Project**, and import
   the GitHub repo you just pushed.
2. Framework preset: Vite (Vercel usually detects this automatically).
   Build command: `npm run build`. Output directory: `dist`.
3. Under **Environment Variables**, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` with the same values from your `.env` (these
   are build-time variables for a Vite app - baked into the built JS at
   build time, not read at runtime - so they must be set here, on Vercel,
   not just in your local `.env`).
4. Since this is a single-page app, add a rewrite so client-side routes
   like `/insights`, `/table`, and `/reset-password` don't 404 on a direct
   load/refresh. Add a `vercel.json` at the repo root:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
5. Deploy. Once you have the resulting `https://your-app.vercel.app` URL,
   go back to Supabase Auth's **URL Configuration** (see "Authentication
   setup" above) and add it as both the **Site URL** (or an additional
   entry, if you want local dev to keep working too) and a **Redirect
   URL** (`https://your-app.vercel.app/reset-password`) - without this,
   the "forgot password" email link will send people to `localhost`
   instead of your deployed site.
6. Deploy the `parse-job` Edge Function to the same Supabase project (see
   "Deploying the `parse-job` Edge Function" above) - it is deployed
   independently of the frontend host, via the Supabase CLI, not Vercel.

## Multi-user security model

Every job row has a `user_id` column, and `supabase-v2_6-multi-user.sql`
sets up four Postgres Row Level Security policies - one each for
`select`/`insert`/`update`/`delete` - that scope every one of those
operations to `user_id = auth.uid()`, for the `authenticated` role only
(the old MVP's permissive `anon` policies are dropped by that same
migration). This is the actual enforcement boundary: it holds regardless
of what the frontend code does, so a browser DevTools console, a modified
request, or a bug in this app's own React code still cannot read, create,
modify, or delete another user's rows - Postgres itself refuses the query.
Concretely:

- **Reads** (`fetchJobs` in `src/services/jobs.ts`, used by `useJobs` for
  Insights, Table, and CSV export) apply no client-side user filter at
  all - none is needed, since the signed-in user's Supabase session
  already scopes every `select` to their own rows via RLS. There is
  nothing in application code that could accidentally leak another user's
  data by omitting a filter.
- **Inserts** (new jobs and CSV/Excel imports) always explicitly attach
  the signed-in user's id (`createJob(input, userId)` in
  `src/services/jobs.ts`, threaded through `useJobs`/`saveValidRows`), and
  the `user_id` column's own `default auth.uid()` is a second, DB-level
  line of defense if a future code change ever forgot to. The insert
  policy's `with check (user_id = auth.uid())` rejects any attempt - buggy
  or malicious - to create a row owned by someone else.
- **Updates** (status changes, edits) cannot reassign a row's `user_id` to
  another user either, for the same `with check` reason, and can only
  target rows the signed-in user already owns (the `using` clause).
- **Unauthenticated requests** - no session at all - match none of the
  four `to authenticated` policies, so Postgres RLS's default-deny applies:
  they cannot read, create, modify, or delete anything in the table.
  `.gitignore` and `revoke all on public.jobs from anon` (also in the
  migration) further ensure the `anon` API key has no table privileges to
  fall back on even before RLS is evaluated.
- **The `parse-job` Edge Function** independently requires a signed-in
  caller too (see "Deploying the `parse-job` Edge Function" above) - it
  never touches the database itself, but without this check anyone with
  your public anon key could have used it as a free URL-fetching proxy.

**What this migration does not do:** it does not automatically assign
existing/legacy rows (`user_id IS NULL`) to your account - see "Legacy
rows with `user_id IS NULL`" inside `supabase-v2_6-multi-user.sql` for why,
and the manual, opt-in SQL to do that yourself if you have rows you want
to keep.

**What's still out of scope for this MVP**, even with per-user isolation in
place: no email-domain allow-list (anyone can sign up, unless you add one
yourself in Supabase Auth), no admin/moderation tools, no rate limiting
beyond whatever Supabase Auth applies by default, and no way for a user to
delete their own account from within the app (that would need to happen
from the Supabase dashboard). None of these affect whether one user's job
data is visible to another - that guarantee comes entirely from the RLS
policies above.

## Known limitations (by design, per MVP scope)

- Email + password authentication only - no social login (not configured
  for this project), no team/organization accounts, no roles or shared
  workspaces, and no in-app way to delete your own account (see "Multi-user
  security model" above). Every account's data is fully private to it;
  there is no collaboration feature of any kind.
- No scheduled backend scraping, automatic status monitoring, or
  notifications - all data entry and status changes are manual (or via the
  one-time URL parse on creation, or the one-time bulk import below).
- No email access/parsing, resume upload/parsing, or AI-generated analysis.
- No Kanban board (removed in V2 in favor of the Insights page as the
  landing page - see the V2 note under Features).
- Insights has no historical transition log - the schema stores only each
  job's current `status`, never a record of status changes over time. The
  application overview and status distribution panels reflect current
  status only and never infer that a job passed through earlier stages. Insights always reflects
  every stored job; it intentionally has no filter bar of its own (use the
  Table page to filter).
- Table filters run client-side.
- `parse-job` cannot parse JavaScript-rendered, login-gated, or
  CAPTCHA-protected pages - see "URL parsing limitations" above.
- **CSV/Excel import** (Table page -> "Import jobs") is capped at 200 rows
  per file, is skip-duplicates-by-default (an existing job is never
  overwritten by an import), and its optional "parse missing fields from
  job links" step is subject to the same `parse-job` limitations as manual
  URL parsing above - rows whose links can't be parsed are kept and flagged
  for manual review rather than dropped.
- The `xlsx` (SheetJS) package used for Excel import has open npm-registry
  advisories (prototype pollution, ReDoS) with "no fix available" on the
  npm registry as of this writing; SheetJS's own patched builds are only
  distributed from their CDN (`cdn.sheetjs.com`), not npm. This is judged
  low-risk because the import happens entirely client-side and only ever
  parses a file the signed-in user themselves selects from their own
  device (never a file another user uploaded or a value from the
  database), but if you want the patched build, install it manually from
  `https://cdn.sheetjs.com/` in place of the npm version.
