# DEPLOY_CPANEL.md — TCG E-Commerce on cPanel (Local Build, Remote Run)

> **Architecture**: NOTHING that touches the Prisma CLI (or any build tool) ever executes on the cPanel server. CloudLinux LVE caps the account at ~4GB virtual memory; the Prisma CLI's Wasm schema validation needs more than that and dies with `RangeError: WebAssembly.Instance(): Out of memory`. So the pipeline is: **build + generate + zip locally → upload + install runtime deps + start on the server**.
>
> Tools used (all inside cPanel): **File Manager**, **MySQL Databases**, **phpMyAdmin**, **Setup Node.js App**. Optional local tools: Node 20+, npm, `zip`.

---

## Why "Local Build, Remote Run" (what was wrong before)

| Server-side trigger (BANNED) | Why it crashed |
|---|---|
| `postinstall: "prisma generate"` in `backend/package.json` | cPanel's *Run NPM Install* ran it → Prisma CLI → Wasm schema validation → OOM under LVE |
| `prisma` + `@prisma/client` in production `dependencies` | `npm install --omit=dev` still pulled the CLI/client packages whose own `postinstall` hooks fired `prisma generate` / engine downloads |
| `prisma generate` / `migrate` / `db push` scripts intended for the server | Any of them loads `prisma-schema-wasm` → `WebAssembly.Instance(): Out of memory` |

**The fix (already applied to this repo):**

1. `backend/package.json` has **no** `postinstall`/`preinstall`/`prestart`/`prepare` hooks, and **no prisma packages** in `dependencies` — a server-side `npm install` physically cannot trigger Prisma.
2. The Prisma Client is **pre-generated locally** into `backend/src/generated/prisma` (custom `output` in `prisma/schema.prisma`), bundling its own runtime + query-engine binaries (including `rhel-openssl-*` targets for CloudLinux). It is a standalone require — works with zero prisma packages in `node_modules`.
3. `backend/.npmrc` (written into the deploy zip by `pack-cpanel.sh`) sets `ignore-scripts=true`, so even a stray *Run NPM Install* cannot run any package lifecycle scripts.
4. Schema changes reach the production DB from **your machine** via `scripts/remote-prisma.js` (migrate deploy / status, db seed) — the only entity that ever executes Prisma CLI is your local dev box.

---

## Overview (5 steps)

| # | Step | Where | Tool | Time |
|---|------|-------|------|------|
| 1 | Create MySQL DB + user | cPanel | MySQL Databases | ~3 min |
| 2 | Build & pack locally (`bash pack-cpanel.sh`) | LOCAL | terminal | ~2 min |
| 3 | Import `migration.sql` (first deploy only) | cPanel | phpMyAdmin | ~5 min |
| 4 | Upload & extract `deploy-cpanel.zip` | cPanel | File Manager | ~2 min |
| 5 | Create Node.js app, install deps, start | cPanel | Setup Node.js App | ~5 min |

> Later schema updates skip step 3 and use the **remote migration** flow at the bottom instead.

---

## Step 1 — Database: create DB + user (cPanel)

cPanel > **Databases > MySQL Databases**:

| Item | Example value |
|---|---|
| Database name | `cpaneluser_tcgdb` (cPanel prefixes your username) |
| Database user | `cpaneluser_tcg` |
| Password | generate & save (needed in Step 5) |

1. **Create New Database** → name → *Create Database*.
2. **MySQL Users > Add New User** → user + password → *Create User*.
3. **Add User To Database** → select both → *Add* → check **ALL PRIVILEGES** → *Make Changes*.

> The Node app connects to this DB via `localhost` from the same server — no Remote MySQL needed for the app itself.

---

## Step 2 — Local build & pack (on YOUR machine)

From the repo root (requires Node 20+, npm, `zip`):

```bash
npm install                 # repo root — installs workspaces (prisma CLI as devDep)
bash pack-cpanel.sh          # → deploy-cpanel.zip
```

`pack-cpanel.sh` (in order):

1. Builds the Vite frontend into `backend/public/` (staged).
2. Runs `npx prisma generate` **locally** → `backend/src/generated/prisma` (client + engine binaries).
3. Verifies the generated client + engines exist, and that `backend/package.json` has no lifecycle hooks and no prisma runtime deps (aborts otherwise — protects you from regressing into the Wasm OOM).
4. Stages runtime-only backend files, writes the server-side `.npmrc` (`ignore-scripts=true`), copies `migration.sql` + this guide, writes `.env.production` template + `.htaccess`, and zips everything.

Sanity-check the archive before uploading:

```bash
unzip -l deploy-cpanel.zip | grep -E 'generated/prisma/index.js|\.npmrc|migration.sql|public/index\.html'
# must show: backend/src/generated/prisma/index.js, backend/.npmrc, migration.sql, backend/public/index.html
```

---

## Step 3 — Import `migration.sql` (FIRST DEPLOY ONLY — via phpMyAdmin)

> Skip this entirely on redeploys. For later schema changes use the *Remote migration flow* section.

1. cPanel > **phpMyAdmin** → left sidebar → **click your database** (must target it).
2. **Import** → *Choose File* → `migration.sql` (from the extracted zip in Step 4, if not extracted yet, come back) → format **SQL** → **Go**.
3. Wait for the green success banner.

What the import creates:

- All application tables (users, products, orders, payments, chat, gacha, settings…)
- `_prisma_migrations` bookkeeping rows (checksums match the local migration files — so later `migrate deploy` from your machine sees the DB as fully migrated)
- Default admin: **admin@tcg.com / Admin@123** — *change immediately after first login*

Verify: phpMyAdmin → your DB → ~28 tables; **AppSetting** → Browse → row `shipping:default_fee | 35000` exists.

---

## Step 4 — Upload & extract (cPanel File Manager)

1. cPanel > **Files > File Manager**.
2. Navigate to `/home/CPANELUSER/` → **+ Folder** → `tcg`.
3. Enter `tcg` → **Upload** → `deploy-cpanel.zip` → wait for 100% → back.
4. Select the zip → **Extract** → extract in place → **Extract File(s)** → delete the zip.
5. **Settings** (top-right) → check **Show Hidden Files (dotfiles)** → *Save* (to see `.htaccess`, `.env.production`).

Extracted layout:

```
/home/CPANELUSER/tcg/
├── .htaccess          # Apache/Passenger routing (shipped in zip)
├── .env.production    # environment variable TEMPLATE (read it in Step 5 — do NOT serve)
├── DEPLOY_CPANEL.md   # this guide
├── migration.sql      # imported in Step 3 (keep for reference)
└── backend/           # app: app.js + src/ (incl. src/generated/prisma) + prisma/ + public/
```

Notes:

- `backend/public/` contains the **pre-built frontend**. Never run any build on the server.
- `backend/public/uploads/` holds product images — keep writable; never delete between deploys.
- `backend/.npmrc` ships with `ignore-scripts=true` — a server-side *Run NPM Install* then installs plain runtime deps only, running zero package lifecycle scripts (this is the belt-and-suspenders guard against any prisma hook).

---

## Step 5 — Create the Node.js app (cPanel Setup Node.js App)

cPanel > **Software > Setup Node.js App** > **Create Application**:

| Field | Value |
|---|---|
| Node.js version | **20.x or newer** |
| Application mode | **Production** |
| Application root | `tcg/backend` |
| Application URL | your domain |
| Application startup file | **app.js** |
| Passenger log file | `tcg/logs/passenger.log` (default suggestion) |

### Environment variables (same form)

Open `.env.production` (File Manager > Edit) for reference and fill real values for every key:

| Key | Value / note |
|---|---|
| `NODE_ENV` | `production` |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `3306` |
| `DB_USER` | `cpaneluser_tcg` |
| `DB_PASS` | your DB user password |
| `DB_NAME` | `cpaneluser_tcgdb` |
| `DATABASE_URL` | `mysql://cpaneluser_tcg:PASSWORD@localhost:3306/cpaneluser_tcgdb` — **URL-encode special chars** (`@`→`%40`, `#`→`%23`, `/`→`%2F`) |
| `DB_POOL_LIMIT` | `5` (shared hosting — keep small) |
| `DB_POOL_TIMEOUT` | `10` |
| `DATABASE_SSL_MODE` | `disable` (localhost needs no SSL) |
| `JWT_ACCESS_SECRET` | long random string (32+ chars) |
| `JWT_REFRESH_SECRET` | a DIFFERENT long random string |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com` — **no trailing slash** |
| `CORS_ALLOWED_ORIGINS` | `https://yourdomain.com` — no trailing slash, comma-separate extra origins |
| `SEPAY_API_URL` | `https://my.sepay.vn` |
| `SEPAY_ENV` | `production` |
| `SEPAY_MERCHANT_ID` | from SePay dashboard |
| `SEPAY_MERCHANT_SECRET_KEY` | from SePay dashboard |
| `SEPAY_WEBHOOK_SECRET` | from SePay dashboard |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | your mail server |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first admin login (only used by seed) |
| `IMGBB_API_KEY` | your ImgBB key |

> **Secret generator tip (no terminal):** any reputable online base64/random generator — two DIFFERENT 32+ char strings for the JWT secrets.

Click **Create**.

### Install dependencies & start

1. In the app row, click **Run NPM Install**. With the shipped `.npmrc` (`ignore-scripts=true`) and prisma-free `package.json`, this installs ~150 plain runtime packages and runs **zero** lifecycle scripts — the Prisma CLI is never invoked, so the Wasm OOM is impossible.
   - *Alternative (fully script-free):* skip NPM Install entirely and see *Ship node_modules (optional)* below.
2. Click **Restart** (always **Restart** after editing env vars — that's how Passenger reloads them).

### Verify

| Check | Expected |
|---|---|
| `https://yourdomain.com/` | Storefront loads (pre-built SPA) |
| `https://yourdomain.com/api/v1/products` | JSON response |
| `https://yourdomain.com/health` | `{"data":{"status":"ok"}}` |
| Admin login | `admin@tcg.com` / `Admin@123` — **change immediately** |

Logs: **Setup Node.js App** > your app > **Passenger log file** (or File Manager > `~/tcg/logs/passenger.log`).

> **SePay webhook:** set the dashboard webhook to `https://yourdomain.com/api/v1/webhooks/sepay`.

---

## Ship node_modules (optional, zero-install deploy)

If you'd rather not run *Run NPM Install* on the server at all, build prod deps locally and include them in the upload. **Linux-to-Linux only** (native modules must match the server's glibc — do NOT do this from Windows/macOS):

```bash
# locally, after pack-cpanel.sh:
cd backend && npm ci --omit=dev
# then upload backend/node_modules too (File Manager, same folder as package.json)
```

None of the 16 runtime deps require install scripts (the `.npmrc` guard also blocks them), so a copied `node_modules` works as-is and the server executes nothing but `node app.js`.

---

## Remote migration flow (schema updates after first deploy)

The production DB is reached from **your machine** only, with the CLI running locally (full memory, no LVE):

1. Copy the template once: `cp backend/.env.cpanel.example backend/.env.cpanel` and fill in the cPanel DB credentials (`DB_HOST` = your host's DB hostname — see below).
2. Enable remote access for your IP: cPanel > **MySQL Databases** > **Remote MySQL** > add your public IP. (If the host blocks remote MySQL entirely, use the fallback below.)
3. From the repo root:

```bash
npm run db:migrate:remote            # prisma migrate deploy → remote DB
npm run db:migrate:remote:status     # prisma migrate status
npm run db:seed:remote               # idempotent seed (skips when data exists)
```

How it stays safe:

- `scripts/remote-prisma.js` only allows `migrate deploy`, `migrate status`, `db seed` — `migrate dev` / `db push` / `db reset` are refused.
- It refuses `localhost`-style hosts (protects you from pointing at your dev DB by accident).
- The `DATABASE_URL` is composed with full URL-encoding from the `DB_*` parts (safe for any password characters).

**Fallback when remote MySQL is blocked (host-common):** export the pending migration(s) as SQL locally and import via phpMyAdmin:

```bash
# locally — render pending migrations as SQL without touching the remote DB:
cd backend && npx prisma migrate diff \
  --from-url "$(node scripts/db-url.js 2>/dev/null || true)" \
  --to-schema-datamodel prisma/schema.prisma --script > pending.sql
```

Then cPanel > phpMyAdmin > your DB > **SQL** tab > paste the contents of `pending.sql` > **Go**. Finally, keep `_prisma_migrations` bookkeeping aligned (only needed if you skip `migrate deploy`):

```sql
INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`)
VALUES (UUID(), '<sha256-of-migration.sql>', NOW(3), '<migration_folder_name>', NULL, NULL, NOW(3), 1);
```

> The `<sha256>` is the SHA-256 hex of the migration's `migration.sql` file — compute locally with `sha256sum backend/prisma/migrations/<name>/migration.sql`. If that bookkeeping feels fragile, prefer asking your host to whitelist your IP for Remote MySQL — `migrate deploy` from your machine is always the clean path.

---

## Updating the application later

1. `bash pack-cpanel.sh` locally → fresh `deploy-cpanel.zip`.
2. File Manager: upload into `~/tcg/` → **Extract** (overwrite) → delete zip.
   - Do NOT delete `backend/public/uploads/` content.
   - Do NOT re-import `migration.sql` (that's first-deploy only; use the remote migration flow instead).
3. If `package-lock.json` changed: **Setup Node.js App** > **Run NPM Install** (safe — no scripts run).
4. If the Prisma schema changed: run `npm run db:migrate:remote` (or the phpMyAdmin fallback) **before** restarting.
5. **Restart** the application.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `RangeError: WebAssembly.Instance(): Out of memory` | Prisma CLI ran server-side. Confirm: (a) the zip's `backend/package.json` has no `postinstall`, (b) `backend/.npmrc` exists with `ignore-scripts=true`, (c) `backend/src/generated/prisma/index.js` exists. Re-pack with `pack-cpanel.sh` — its step [4/8] guards against exactly this. |
| 503 on every request | **Restart** in Setup Node.js App; check the Passenger log |
| App fails to start | Passenger log: usually missing env vars (all keys in Step 5 are required) or a wrong `DATABASE_URL` |
| `P1001: Can't reach database server` | Wrong `DB_*` values, or the user wasn't added to the DB with ALL PRIVILEGES |
| `@prisma/client did not initialize yet` / `did you run prisma generate` | The upload clobbered `backend/src/generated/prisma`. Re-upload the zip; never run prisma generate on the server. |
| phpMyAdmin import fails | Select your DB in the left sidebar first; DB must be empty (no half-imported tables) |
| Only the API responds (no storefront / `Cannot GET /` on `/`) | The zip's `backend/public/` lacks the built SPA (`index.html`, `assets/`) — an old pack shipped only `public/uploads`. Re-pack with the fixed `pack-cpanel.sh` (it now stages `frontend/dist/` into `backend/public/`) and re-upload Step 4. |
| Blank page / 404 on refresh | `.htaccess` missing — enable *Show Hidden Files* and re-extract |
| CSS/JS 404 | Fresh re-deploy (pre-built `backend/public/` was overwritten) |
| Uploaded images 404 | Recreate `backend/public/uploads/` via File Manager |
| Env var changes ignored | Always **Restart** after editing env vars |
| Remote migrate: `P1001 Can't reach db host` | Your IP isn't whitelisted in Remote MySQL, or the host blocks 3306 — use the phpMyAdmin fallback |

### Order stuck on PENDING (Đang thanh toán) after payment succeeded

Diagnose via phpMyAdmin — select your DB > **SQL** tab > run:

```sql
SELECT sepayTransactionId, status, errorMessage, amount, content, createdAt
FROM PaymentLog ORDER BY createdAt DESC LIMIT 20;
```

| PaymentLog status | Cause | Fix |
|---|---|---|
| `AMOUNT_MISMATCH` | SePay collects integer VND; order total had decimals (tolerance ≤ 1 VND handled in code — old stuck orders need recovery below) | Admin panel → Payment Logs → **Mark as completed** |
| `SIGNATURE_MISMATCH` on every signed IPN | `SEPAY_WEBHOOK_SECRET` doesn't match the SePay dashboard | Fix the env var in Setup Node.js App > **Restart** |
| `INVALID_PAYLOAD` | Order code (TCG-…) missing from transfer content | Customer paid with an edited transfer message |
| `MISMATCH` — no order found | Customer paid a stale/expired order code | Admin reconcile via admin panel |
| No rows at all | Webhook never reached the app | Set the webhook URL in the SePay dashboard to `https://yourdomain.com/api/v1/webhooks/sepay` |

**User-triggered sync (GUI):** the buyer re-opens `/payment/success?orderId=…` (auto-calls the sync-payment endpoint), or an admin triggers sync from the admin panel → Payment Logs.

### Webhook smoke test (no terminal needed)

Quick alive-check: open `https://yourdomain.com/api/v1/webhooks/sepay` in a browser — the JSON response must show your real domain in `data.webhookUrl` (not localhost). For a full signed-IPN test, use the admin panel or ask the host to check the Passenger log while a test payment is made.
