# Cane Permit Tracker v3

Angata Sugar Mills' harvest-permit workflow as one web app: the scout captures the farmer and field, the call centre confirms the details with the farmer, IT checks the data and posts it to Synergy Bravo, the permit officer opens the permit and issues CCS clips, Legal confirms the physical documents, and GIS confirms the transport zone. Every entry carries its full history, and the administrator sees everything.

Built for Vercel: Next.js 15 (App Router, TypeScript, Tailwind), Postgres via Drizzle ORM (Neon from the Vercel Marketplace, or any Postgres), Vercel Blob for photos, signed-cookie sessions with bcrypt passwords.

## Roles and what they see

| Role | Menu | Can do |
|---|---|---|
| Administrator | Overview, All entries, Users, Harvesters, Banks, CBCs & zones | See every entry and every action; add users with a temporary password, change roles, deactivate; manage reference lists; download CSV |
| Field scout | New entry, My entries | Capture an entry; see only their own entries and status; correct and resubmit a returned entry |
| Call centre | My queue, Completed | Phone the farmer, tick each confirmed item, log failed attempts, return to scout |
| IT data check & ERP | My queue (two sections), Completed | Verify against ID and bank card photos, then record the ERP farmer/field codes |
| Legal | My queue, Completed | Once the permit is open, confirm the physical documents received (ID copy and signed terms required), record the file reference |
| Permit officer | My queue, Completed | Record the permit number and CCS clips |
| GIS zoning | My queue, Completed | Confirm the field was inspected and the polygon reviewed; confirm or override zone, CBC and distance |

"My queue" shows only the entries waiting on that role. "Completed" lists entries that person has actioned, with how far each has gone since. Stage users can open an entry only if it is in their queue or they have acted on it; the administrator can open anything.

## The pipeline

```
Submitted → Farmer confirmed → Data checked → In ERP → Permit issued → Documents received → Zoned
  (scout)    (call centre)     (IT)           (IT)      (permit)         (legal)              (GIS)
```

Every entry gets a unique serial when it is saved, `CP-<year>-<5-digit sequence>` (e.g. `CP-2026-00042`), issued atomically from a database counter and protected by a unique constraint, so two scouts saving at the same moment can never collide. It is shown on every list and detail page and in the CSV.

Any stage can **return** an entry to the scout with a reason; the scout corrects it and it restarts at the call centre. IT can **reject** an entry outright (land dispute, duplicate contract, fraud). The order of stages, which role works each one, and the checklists are defined in one place: `src/lib/workflow.ts`.

### Transport zones

Zones are 3 km bands of straight-line distance from the field polygon's centroid to the nearest active CBC: A 0–3 km, B 3–6, C 6–9, D 9–12, E 12–15, **F 15 km and above**. The scout's form computes acreage, centroid, nearest CBC, distance and zone from the polygon as it is drawn; the server recomputes them on save; GIS confirms or overrides at the last stage. Band width and letters live in `src/lib/zones.ts`; CBC coordinates are managed under Admin → CBCs & zones.

### Bank details

Choosing a bank fills its code from the bank master and fixes the number of digits the account number must have (digits only, enforced on the phone and again on the server). The seeded master lists National Bank four times with different digit counts; deactivate the variants the ERP does not accept.

### Consent

The farmer's undertaking (the terms and conditions, filled with their name and ID) and the Data Protection Statement are shown in the form; the scout ticks both on the farmer's behalf and the farmer signs on screen. The entry stores the time and version of each. Text lives in `src/lib/legal-text.ts`; bump the version strings when the wording changes.

## Deploy to Vercel

You need a Vercel account, a GitHub (or GitLab/Bitbucket) repository containing this folder, and about 20 minutes.

1. **Push the code** to a repository.
2. **Import the project** in Vercel (Add New → Project → pick the repository). Framework preset: Next.js. Leave build settings at their defaults. Don't deploy yet — add storage first.
3. **Add a Postgres database**: in the Vercel project, *Storage → Create Database → Neon (Postgres)*. Accept the defaults and connect it to the project. This sets `DATABASE_URL` for you. (Any other Postgres works too — paste its pooled connection string as `DATABASE_URL` under *Settings → Environment Variables*.)
4. **Add a Blob store** for photos: *Storage → Create → Blob*. Connecting it sets `BLOB_READ_WRITE_TOKEN`.
5. **Set the remaining variables** under *Settings → Environment Variables* (all environments):
   - `AUTH_SECRET` — a long random string, e.g. the output of `openssl rand -base64 32`
   - `SEED_ADMIN_USERNAME`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD` — the first administrator (only used by the seed step)
6. **Deploy** (Deployments → Redeploy, or push a commit).
7. **Create the tables and seed the reference data** — once, from your computer:
   ```bash
   npm install
   npx vercel link          # pick the project
   npx vercel env pull .env # downloads the variables into .env
   npm run db:migrate       # applies drizzle/*.sql
   npm run db:seed          # CBCs, harvesters, banks, first admin
   ```
8. Open the deployment URL, sign in as the administrator, change the password, and add users under *Users*. Each new user gets a temporary password shown once; they must change it at first sign-in.

Later schema changes: edit `src/lib/db/schema.ts`, run `npm run db:generate` to produce a migration, commit it, and run `npm run db:migrate` against production after deploying.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (pooled, with `sslmode=require` for hosted databases) |
| `AUTH_SECRET` | Signs the session cookie (12-hour sessions) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for photo and signature uploads |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_NAME` / `SEED_ADMIN_PASSWORD` | First administrator, created by `npm run db:seed` if missing |

`/api/health` returns `{ ok: true }` when the app can reach the database; point an uptime monitor at it.

## Run locally

```bash
npm install
cp .env.example .env     # set DATABASE_URL to a local or hosted Postgres, and AUTH_SECRET
npm run db:migrate
npm run db:seed
npm run dev              # http://localhost:3000
```

Without `BLOB_READ_WRITE_TOKEN`, development mode keeps uploaded photos inline (as data URLs) so the full flow works offline. Production refuses to start uploads without the token.

`test/e2e.py` is the end-to-end browser test used during development (Python + Playwright): it creates one user per role and drives two entries through the whole pipeline, including a return and resubmission. Run it against `npm run dev -- -p 3100` after `test/reset.sh`.

## Project layout

```
src/app/                 routes (App Router)
  login/                 sign-in
  (app)/                 everything behind sign-in, wrapped in the shell
    entries/             list, new, [id] detail, [id]/edit
    queue/ completed/    stage users
    admin/               overview, users, harvesters, banks, cbcs, export (CSV)
    account/             change password
  api/upload             photo upload to Vercel Blob
  api/health             database health check
src/actions/             server actions (auth, entries, workflow, admin)
src/components/          UI: AppShell, EntryForm, PolygonMap, SignaturePad, PhotoInput, StageActionPanel, StageRail, EntryTable, Timeline
src/lib/
  db/schema.ts           Drizzle schema (users, banks, harvesters, cbcs, entries, entry_events, counters)
  workflow.ts            the pipeline: stages, roles, checklists, labels
  zones.ts               haversine, geodesic polygon area, centroid, zone bands
  validation.ts          zod schemas shared by client and server
  legal-text.ts          terms undertaking and data protection statement
  auth/                  password hashing, JWT session cookie, route guards
  queries.ts             list/detail queries and view permissions
src/middleware.ts        redirects signed-out users and forces the first password change
drizzle/                 SQL migrations
scripts/seed.ts          reference data and first admin
data/                    CBC, harvester and bank seed data from the November 2026 workbooks
```

## Security and data protection notes

- Role checks run on the server for every page and every action; the client only hides what you cannot do.
- Passwords are bcrypt-hashed. Sessions are HTTP-only, signed cookies that expire after 12 hours. Deactivating a user blocks their next request.
- Photos and signatures go to Vercel Blob with unguessable URLs (random suffix). They are not listed anywhere public, but anyone holding a URL can open it. If policy requires the files themselves to sit behind sign-in, the upload route (`src/app/api/upload/route.ts`) is the one place to swap in a private store and a download endpoint.
- Every status change is recorded in `entry_events` with who did it and when. Entries are never deleted from the app; rejected entries stay in the record.
- ID numbers, phone numbers and account numbers are stored as text so leading zeros survive the CSV export.
