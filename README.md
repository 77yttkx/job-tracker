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

## Interview Prep (V3.2 - a parent category, with Behavioral (BQ) as its first sub-area)

A second feature area, reachable from the sidebar directly below Table:
**Interview Prep** is a parent category. Its first sub-area, **Behavioral
(BQ)**, is a manual organizer for behavioral-interview answers - it does
**not** call any external AI provider, you write your answers yourself (in
ChatGPT, Claude, your own notes, or wherever you like), then paste, tag,
search, and review them here. A second sub-area, **Technical Interview**,
is visible in navigation with a real route but is not built yet - it shows
a clearly labeled "Coming soon" placeholder rather than a broken page.

Interview Prep is still isolated from the Job Tracker's own pages/data
almost everywhere - see "Interview Prep's independence from Job Tracker"
under "Multi-user security model" below - with **one deliberate, narrow
exception introduced in V3.2**: the "Prepare for a Job" page below, where
a user explicitly opts in to reading one of their own job descriptions.

### Behavioral (BQ)

The active landing page under Interview Prep, with four sections:

- **BQ Questions** (`/interview-prep/bq/questions`) - ten common
  behavioral interview prompts (Leadership, Teamwork, Conflict, Failure,
  Challenge, Ownership, Communication, Problem Solving, Adaptability, Time
  Management - one prompt per tag, see `src/lib/bqPrompts.ts`), each shown
  as a card with its tag. An unanswered prompt has a **Write an answer**
  button that opens the same answer form used everywhere else in
  Interview Prep, pre-filled with that prompt's question and tag (every
  field, including the pre-filled ones, stays editable before you save).
  An already-answered prompt is marked **Answered** and shows **Edit your
  answer** instead, opening that same saved answer. Reopening a prompt you
  already answered always edits that one answer - it never creates a
  duplicate (see "How duplicate answers are avoided" below) - while a
  separate custom answer to a similar question, created via My Answers,
  coexists without colliding with it.
- **My Answers** (`/interview-prep/bq/answers`, the V3.1 "Answer Library"
  - same feature, moved and renamed) - every saved answer, from a BQ
  Questions prompt or created from scratch via **New Answer**. Fields:
  interview question (required), answer (required), tags (required - at
  least one, from the same ten preset categories as BQ Questions), and
  optional notes. Search now covers question, answer, **and notes**
  (V3.2); filter by tag; edit or delete your own answers. An answer
  created from a BQ Questions prompt shows a small "From BQ Questions"
  note.
- **Prepare for a Job** (`/interview-prep/bq/prepare`) - see its own
  section below; this is the one place Interview Prep reads job data.
- **Story Library** (`/interview-prep/bq/stories`, unchanged from V3.1,
  now nested under BQ) - optional, supporting background material: a
  title, the story text, and tags for a project, conflict, or achievement
  you might draw on when writing an answer.

**No external AI provider, key, or network call is required or used by
any part of Interview Prep**, including Prepare for a Job (its JD
analysis is local keyword matching, not a model call - see below).
Everything above is plain Supabase CRUD, the same as the Job Tracker.

#### How duplicate answers are avoided

`behavior_answers` gained a nullable `prompt_key` column in V3.2 (see
`supabase-v3_2-bq-structure.sql` below). An answer created from a BQ
Questions prompt gets that prompt's key stamped on it; reopening the same
prompt looks up an existing answer by that key and edits it instead of
inserting a new row (`src/lib/bqPromptMatching.ts`). An answer created via
My Answers' plain "New Answer" button always has `prompt_key = null`, so
it's never mistaken for "answering" a guided prompt - you can have both a
guided-prompt answer and a separate custom answer on a similar topic at
once, by design.

### Prepare for a Job

**The one deliberate exception to "Interview Prep never reads
`public.jobs`."** You explicitly pick one of your own Job Tracker entries
(filterable by company); nothing is read until you do. The page then:

1. Reads only that job's own `jd` (job description) text - never any
   other job, never another user's data (the job list itself is the same
   RLS-scoped `jobsState` Insights/Table already use - see "How this is
   secured" below).
2. Matches that text against a fixed, centralized keyword/synonym list
   (`src/lib/jdKeywords.ts`) for seven BQ-relevant competencies
   (Collaboration/Teamwork, Ownership, Data Analysis/Problem Solving,
   Communication, Ambiguity/Adaptability, Leadership, Time
   Management/Prioritization) - **local, deterministic string matching,
   not a model call**, labeled in the UI as "JD keyword match," never "AI
   analysis." Every detected competency chip is editable - remove one
   that doesn't fit, or add one manually from the full list.
3. Recommends your saved answers and stories whose tags overlap the
   final (edited) competency selection, ranked exact-match-first, each
   with a one-line explanation ("Matches Ownership and Problem Solving
   from this job description.") - see `src/lib/bqRecommendations.ts`.
   Never fabricates or edits an answer automatically; clicking a
   recommended answer just opens it for editing, same as anywhere else.
4. If nothing matches yet, offers a one-click way to start a new answer
   from a BQ Questions prompt that fits the first selected competency,
   with that prompt's question and tag pre-filled.

**Persistence decision:** a "job preparation session" (competency
selections, snapshot of the job/JD) is **not** saved to the database in
this version - the analysis lives only in this page's UI state and resets
if you navigate away or reload. See "Why Prepare for a Job doesn't persist
sessions (yet)" below for the reasoning.

#### How this is secured

- **No separate fetch.** `PrepareForJobPage` receives the exact same
  `jobsState` (from the single `useJobs(userId)` call in `src/App.tsx`)
  that `InsightsPage`/`TablePage` already receive as a prop - it never
  calls `useJobs()` itself and never queries the `jobs` table directly
  (verified by `src/__tests__/interviewPrepNavigationAndIndependence.test.ts`).
  That means every job you can select here is already scoped to you by
  the same Postgres RLS policies described under "Multi-user security
  model" - there is no separate code path that could show or select
  another user's job.
- **No write path.** This page has no `addJob`/`editJob`/`removeJob`
  call anywhere in it (also verified by the same test) - it is read-only
  with respect to `public.jobs`.
- **No new column, foreign key, or RLS change on `public.jobs`.** The
  only schema change in V3.2 is the additive `prompt_key` column on
  `behavior_answers` (see "Supabase setup" below) - `public.jobs` itself
  is untouched, confirmed by `src/__tests__/bqStructureMigration.test.ts`.
- **Explicit, per-job opt-in.** No job is read, scanned, or summarized
  until you pick one from the list; nothing runs in the background.

## Tech stack

React 18 + TypeScript + Vite, Tailwind CSS, Supabase (Postgres + Auth +
Edge Functions), React Router, Recharts (bar + line charts), `xlsx`
(SheetJS, for CSV/Excel import - loaded lazily, only when the Import modal
opens), Lucide React (icons), Vitest (unit tests). **Interview Prep uses
no additional external service** - it's plain Supabase CRUD plus local,
deterministic keyword matching for Prepare for a Job, never a model or API
call. (A now-unused, Gemini-based Edge Function from the original V3
remains deployed-but-uncalled; see "Gemini API setup (legacy, unused)"
below.)

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
7. **Optional - only if you want Interview Prep:** run, in this order, in
   the SQL editor:
   `supabase-v3-interview-prep.sql`, then `supabase-v3_1-manual-answers.sql`,
   then `supabase-v3_2-bq-structure.sql`.
   - `supabase-v3-interview-prep.sql` is purely additive - it creates two
     new tables (`personal_stories`, `behavior_answers`) plus a small
     `generation_usage` quota table (unused since V3.1, kept for existing
     data compatibility), and never adds a column, policy, trigger, or
     foreign key to `public.jobs` (verified by
     `src/__tests__/interviewPrepMigration.test.ts`).
   - `supabase-v3_1-manual-answers.sql` is also purely additive - it makes
     `behavior_answers.story_id`/`duration`/`tone` nullable (so an answer
     no longer requires a linked story or the old AI-only duration/tone
     fields) and adds a `tags text[] not null default '{}'` column, so
     existing generated answers keep working unchanged while new manual
     answers can be created without them (verified by
     `src/__tests__/manualAnswersMigration.test.ts`). Safe to run even if
     you have zero rows, and safe to run more than once.
   - `supabase-v3_2-bq-structure.sql` (new) is also purely additive - it
     adds a nullable `prompt_key text` column to `behavior_answers` (so a
     BQ Questions answer can be matched back to its prompt template and
     never duplicated - see "How duplicate answers are avoided" above)
     plus a partial index on it. It changes no RLS policy (row-scoped
     RLS already covers a new column with no changes needed) and never
     touches `public.jobs` or `public.personal_stories` (verified by
     `src/__tests__/bqStructureMigration.test.ts`). Safe to run even if
     you have zero rows, and safe to run more than once.

   Skipping any of these three just means the affected Interview Prep
   pages will show query errors when opened - the rest of the Job
   Tracker is unaffected either way.
8. **Not required as of V3.1:** Interview Prep no longer uses Gemini or
   any external AI provider, so there is nothing to deploy or configure
   for it. The old step 8 (Gemini secrets + `generate-star-answer`
   deploy) only matters if you want to keep the now-unused Edge Function
   redeployable for some other purpose - see "Gemini API setup (legacy,
   unused)" below.

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

### Gemini API setup (legacy, unused as of V3.1)

**You do not need to do anything in this section.** As of V3.1, Interview
Prep is a manual answer organizer and the frontend never calls Gemini or
any external AI provider - `src/__tests__/geminiSecretHygiene.test.ts`
fails the build if that ever stops being true. This section is kept only
because the `generate-star-answer` Edge Function itself is still deployed
(untouched, per the V3.1 change) and documented here in case you want to
redeploy it for some other purpose, or eventually remove it (see
"Can the Gemini secret/Edge Function be removed?" below).

Interview Prep's old "Generate STAR Answer" step used to call a second,
independent Edge Function, `supabase/functions/generate-star-answer/`. It
was the **only** place in this codebase that ever talked to Gemini - the
browser never saw the API key and never called Gemini directly (see
`src/__tests__/generateStarAnswerFunction.test.ts`, a source-level guard
over that still-deployed function).

**1. Get a free-tier Gemini Developer API key.** Go to
[Google AI Studio](https://aistudio.google.com/) (or
[ai.google.dev](https://ai.google.dev)), sign in, and create an API key.
The free tier is sufficient - this app is designed to stay within it (see
"Interview Prep (V3) limitations" below).

**2. Set the two required secrets** (these are Supabase project secrets,
never `.env` values, and never `VITE_`-prefixed - see "Environment
variables" below for why that distinction matters):

```bash
# your real Gemini API key - do not commit this command with a real value filled in
npx supabase secrets set GEMINI_API_KEY="PASTE_KEY_HERE"

# the Gemini model to use - see the note below on picking one
npx supabase secrets set GEMINI_MODEL="CURRENT_FREE_TIER_FLASH_MODEL"
```

`GEMINI_MODEL` is optional: if you don't set it, the function falls back
to a single centralized default (`DEFAULT_GEMINI_MODEL` in
`supabase/functions/generate-star-answer/index.ts`) rather than failing -
see "Gemini model selection" below for which one and why, and how to move
to a newer one later without touching code.

**3. Deploy the function:**

```bash
npx supabase functions deploy generate-star-answer
```

(Unlike `parse-job`, this function does not need `--no-verify-jwt` -
either flag works, since it performs the same explicit, in-function
`getAuthenticatedUserId`-style check as `parse-job` regardless of the
platform gate; `--no-verify-jwt` is included above only for consistency
with the `parse-job` command if you prefer to keep both the same.)

No frontend changes are needed for this either - the same automatic
`Authorization: Bearer <session.access_token>` behavior described for
`parse-job` above applies here too.

To run/test it locally instead:
`supabase functions serve generate-star-answer --env-file supabase/.env.local`
(create `supabase/.env.local` with your own `GEMINI_API_KEY=...` /
`GEMINI_MODEL=...` for local testing only - never commit that file; it's
already covered by `.gitignore`'s `supabase/.env*` pattern).

#### Gemini model selection

This function reads the model name from the `GEMINI_MODEL` secret so it
is never hardcoded in more than one place. If that secret isn't set, it
falls back to `DEFAULT_GEMINI_MODEL` in
`supabase/functions/generate-star-answer/index.ts` - at the time this was
last verified against Google's own documentation, that fallback is a
current, stable (non-preview), free-tier-eligible Gemini Flash model.
**Google's available models change over time** (the prior generation,
`gemini-2.5-flash`, was retired in mid-2026); if generation starts failing
with an auth/model error, check
[ai.google.dev's models page](https://ai.google.dev/gemini-api/docs/models)
for the current free-tier Flash model name and either set `GEMINI_MODEL`
to it (no redeploy needed - secrets are read at request time) or update
`DEFAULT_GEMINI_MODEL` and redeploy.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL. |
| `VITE_SUPABASE_ANON_KEY` | Yes | Your Supabase anon (public) API key. |
| `VITE_CORS_PROXY_URL` | No | Unused in V2. URL parsing now runs entirely through the server-side `parse-job` Edge Function, so no browser CORS proxy is needed. Kept out of `.env.example` intentionally; safe to remove from any existing `.env`. |

**`GEMINI_API_KEY` and `GEMINI_MODEL` are deliberately not in this table
or in `.env.example`.** They are Supabase *project secrets*, set with
`supabase secrets set` (see "Gemini API setup" above) and read only inside
the `generate-star-answer` Edge Function via `Deno.env.get(...)`. Vite
exposes every `VITE_`-prefixed variable to client-side JavaScript by
design, so a Gemini key must never be given that prefix or placed in
`.env`/`.env.example` - doing so would ship it to every visitor's browser.
`src/__tests__/geminiSecretHygiene.test.ts` guards against this by
scanning the whole frontend source tree for any reference to
`VITE_GEMINI_API_KEY` or a real-looking Gemini key.

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

### Interview Prep (V3.2) limitations

**Manual only - no AI assistance, anywhere.** Interview Prep does not
draft, suggest, score, or fact-check an answer. You write it yourself
(elsewhere or directly in the form) and paste/type it in. Prepare for a
Job's "JD keyword match" is plain local string matching against a fixed
keyword list (`src/lib/jdKeywords.ts`) - it is explicitly not AI analysis,
never claims a keyword it didn't literally find, and never fabricates or
edits an answer for you.

**Legacy generated answers.** If you used the original V3 AI-generation
feature before it was removed, those saved answers are untouched and
still load, display, and remain editable - including their duration/tone
badges, which are a V3-only concept the manual/BQ Questions forms don't
set. They carry a `tags` field (defaulted to empty on the V3.1 migration)
and a `prompt_key` of `null` (V3.2 - they were never created from a BQ
Questions prompt), both editable/usable like any other answer.

**Why Prepare for a Job doesn't persist sessions (yet).** The spec's
suggested `bq_job_preparations` table (storing a snapshot of the selected
job, JD text, and chosen competencies) was deliberately **not** added in
this version. Reasoning: (1) the page is already fully useful without
persistence - the job list, the JD, and your saved answers/stories are all
still there the next time you open it, so "re-running" a prep session
costs one click; (2) every piece of state it would persist is either
already stored elsewhere (the job itself, in `public.jobs`; the matching
logic, deterministic and instant) or is small, disposable UI state (which
competency chips are currently selected) that doesn't obviously benefit
from surviving a reload; (3) adding a table "just in case" is exactly the
kind of unforced schema surface this rewrite's other changes have
deliberately minimized. If real usage shows people wanting to save a named
prep session (e.g. "compare this JD's matches across two different applied
dates"), that table can be added later as a fully additive migration with
its own RLS, no foreign key to `public.jobs`, and no change to how the
page works without it - the spec's schema sketch remains a reasonable
starting point if/when that's needed.

**Out of scope for this MVP** (see the original spec for the complete
list): no linking of a story/answer to a specific job application (beyond
Prepare for a Job's read-only, in-session recommendation matching), no
resume upload, no bulk import of answers, no voice input, no automatic
scoring, no saved/named prep sessions (see above), no AI generation or
analysis of any kind, and no admin dashboard or usage-billing UI.

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

### Interview Prep AI-generation errors below (legacy, V3 only)

The six entries below describe the old "Generate STAR Answer" flow, which
no longer exists in the app as of V3.1 (see "V3.1 change notes" earlier in
this README) - they're kept only in case you're troubleshooting the
still-deployed-but-unused `generate-star-answer` Edge Function directly
(e.g. via `supabase functions invoke`), not something you can hit from the
UI anymore.

### Interview Prep: "AI generation is not configured" (missing `GEMINI_API_KEY`)

The `generate-star-answer` function checked `Deno.env.get('GEMINI_API_KEY')`
and found nothing set. Run
`npx supabase secrets set GEMINI_API_KEY="..."` (see "Gemini API setup"
above) and redeploy - secrets set after a deploy are picked up
automatically on the function's next invocation, so a redeploy isn't
strictly required after setting a secret, but running it again doesn't
hurt if you're unsure.

### Interview Prep: generation fails after Gemini changes/retires a model (missing or stale `GEMINI_MODEL`)

If `GEMINI_MODEL` is unset, the function falls back to
`DEFAULT_GEMINI_MODEL` in `supabase/functions/generate-star-answer/index.ts`.
If Google has since retired that model, Gemini will reject the request
with an auth/not-found-style error. Check
[ai.google.dev's models page](https://ai.google.dev/gemini-api/docs/models)
for the current free-tier Flash model name and set it with
`npx supabase secrets set GEMINI_MODEL="..."` (no redeploy needed) - see
"Gemini model selection" above.

### Interview Prep: 401 "Sign in required to generate an answer"

Same root cause and same fix as "Signed in, but the app still shows 'Sign
in required to parse job URLs'" above, applied to this function instead:
redeploy with `npx supabase functions deploy generate-star-answer`
(`--no-verify-jwt` is not required here but doesn't hurt - see "Gemini API
setup" above).

### Interview Prep: Gemini returns a 401/403 ("AI generation is not configured correctly")

This means Gemini itself rejected the API key - not a Supabase auth
problem. Confirm the key set via `npx supabase secrets set
GEMINI_API_KEY="..."` is current and unexpired in
[Google AI Studio](https://aistudio.google.com/), and that you copied the
whole key with no surrounding whitespace.

### Interview Prep: "AI generation is temporarily unavailable because the Gemini API limit has been reached"

Either this app's own soft daily quota (10 successful generations per
user per UTC day) or Gemini's own free-tier rate limit was hit - see
"Interview Prep (V3) limitations" above. This is expected free-tier
behavior, not a bug; wait and try again later (the app deliberately does
not auto-retry).

### Interview Prep: "Received an unexpected response while generating the answer" (malformed Gemini response)

Gemini returned a response the function couldn't parse into an answer
(an empty/unexpected payload shape, or a moderation block with no usable
text). This is usually transient - try again with a slightly reworded
question. If it persists, check Supabase's function logs for
`generate-star-answer` (the logged error never includes your story or
question text - only a generic error code/message, per "Interview Prep
(V3) limitations" above).

### Interview Prep: "Story not found" when generating

The Edge Function looks up the story scoped to both the story id **and**
your signed-in user id, and returns this same generic message whether the
story doesn't exist or belongs to someone else (deliberately, so a
mistyped or guessed id can't be used to learn whether a story exists on
another account - see `supabase/functions/generate-star-answer/index.ts`'s
`fetchOwnedStory`). If you're sure the story exists and is yours, confirm
you're signed into the same account it was created under, and that
`supabase-v3-interview-prep.sql`'s RLS policies were applied successfully
(Supabase dashboard -> Authentication -> Policies -> `personal_stories`).

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

### Interview Prep's independence from Job Tracker (V3 / V3.1 / V3.2)

`personal_stories` and `behavior_answers` (added by
`supabase-v3-interview-prep.sql`, widened by
`supabase-v3_1-manual-answers.sql` and `supabase-v3_2-bq-structure.sql`)
each carry their own `user_id` column and their own four RLS policies
(`select`/`insert`/`update`/`delete`, scoped to `user_id = auth.uid()` for
the `authenticated` role only) - completely independent of, and
structured identically to, the `jobs` table's own policies described
above. **V3.2 makes one explicit, narrow, product-level exception to the
data-*isolation* guarantee below - it does not touch the schema
independence above at all**: see "Prepare for a Job" and its "How this is
secured" subsection further up for exactly what changed and how it's
still safe. Concretely, the guarantees are now:

- **None of the three migrations touch `public.jobs`** - no column,
  policy, trigger, or foreign key from any Interview Prep table points at
  it - enforced by `src/__tests__/interviewPrepMigration.test.ts`,
  `src/__tests__/manualAnswersMigration.test.ts`, and
  `src/__tests__/bqStructureMigration.test.ts` (each reads its SQL file
  directly).
- **Every Interview Prep source file except one still has zero import of
  the Job Tracker's jobs data layer** (`useJobs`, `services/jobs`,
  `components/jobs`) and never queries the `jobs` table - enforced by
  `src/__tests__/interviewPrepNavigationAndIndependence.test.ts`, which
  scans every Interview Prep source file and asserts this for all of them
  **except** the one deliberate exception,
  `src/pages/interviewPrep/bq/PrepareForJobPage.tsx` (plus its own
  `src/components/interviewPrep/prepareForJob/JobPicker.tsx`
  subcomponent, which renders the job list) - the same test file also
  separately verifies that exception page never fetches jobs itself
  (only ever reads the `jobsState` prop App.tsx already passes to
  Insights/Table) and never writes to `public.jobs` at all.
- **Every story and every saved answer belongs to exactly one signed-in
  user**, the same way every job row does - a story-delete that's blocked
  by a linked answer (`ON DELETE RESTRICT`, not `CASCADE`, on
  `behavior_answers.story_id`) is still enforced by Postgres itself for
  any legacy answer that still links to a story, not just the UI. As of
  V3.1, a new answer no longer has to link to a story at all
  (`story_id` is nullable), so most new answers won't hit this rule.
- Architecturally, Interview Prep's own data-access layer
  (`src/services/stories.ts`, `src/services/answers.ts`,
  `src/hooks/useStories.ts`, `src/hooks/useAnswers.ts`) remains a
  deliberately separate implementation from the Job Tracker's
  `src/services/jobs.ts` / `src/hooks/useJobs.ts` - not a shared
  generalization, and unchanged by V3.2. Prepare for a Job reads jobs
  data only by receiving the already-fetched `jobsState` as a prop, never
  by importing the Job Tracker's data-access layer into Interview Prep's
  own services/hooks.

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
- **Interview Prep (V3.2)** is manual-only and out of scope beyond what's
  described above: no AI drafting/generation of any kind (Prepare for a
  Job's JD matching is local keyword matching, not AI), no resume
  upload/parsing, no bulk import of answers, no voice input or automatic
  transcription, no automatic scoring or grading of an answer, no saved/
  named job-preparation sessions (see "Why Prepare for a Job doesn't
  persist sessions (yet)" above), and no notifications or admin
  dashboard. Technical Interview is a visible "Coming soon" placeholder
  with no functionality yet.
