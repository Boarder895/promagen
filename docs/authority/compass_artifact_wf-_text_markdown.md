# Vercel Cron, Neon BIGINT, and debugging pitfalls for Next.js

**The most likely root cause of the issues described is a chain of authentication failure:** Vercel does not interpolate environment variables in cron `path` strings in vercel.json, so `$PROMAGEN_CRON_SECRET` is sent as a literal string — not the actual secret value. This means the cron endpoint receives garbage auth data, returns a 401/404, Vercel never retries, and `CREATE TABLE IF NOT EXISTS` never executes. Compounding this, any BIGINT values from Neon Postgres arrive as JavaScript strings, causing `Number.isFinite()` checks to silently return `false`. Below is a complete breakdown of every issue.

---

## Vercel sends an Authorization header, not a query param

When Vercel triggers a cron job, it sends an **`Authorization: Bearer <CRON_SECRET>`** header automatically — but only if an environment variable named exactly **`CRON_SECRET`** exists in the project's settings. Vercel also sets the `User-Agent` header to `vercel-cron/1.0` on every cron invocation. The `CRON_SECRET` value is **not auto-generated** — the developer must create it manually (Vercel recommends at least 16 random characters, e.g. via `openssl rand -hex 32`) and add it to the project's environment variables through the dashboard.

The recommended handler pattern checks this header directly:

```ts
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return new Response('Unauthorized', { status: 401 });
}
```

**Critical finding: Vercel does NOT interpolate environment variables in cron paths.** A vercel.json entry like `"path": "/api/promagen-users/cron?secret=$PROMAGEN_CRON_SECRET"` sends the literal string `$PROMAGEN_CRON_SECRET` as the query parameter value — it is never replaced with the environment variable's actual value. This was confirmed in GitHub Discussion #9611, and the vercel.json documentation explicitly states that `$VAR` references in unsupported contexts stay as literal strings. The `crons` config has no `env` property or variable expansion mechanism.

The practical difference between `CRON_SECRET` and a custom secret like `PROMAGEN_CRON_SECRET` is significant. `CRON_SECRET` is a magic name recognized by the platform — Vercel automatically includes it as a Bearer token header, keeping the secret out of URLs and logs. A custom query-param secret either requires hardcoding the value in vercel.json (exposing it in source control) or using `$VAR` syntax that doesn't work. **The only officially supported and secure method is `CRON_SECRET` via the Authorization header.**

## Hobby plan supports crons but limits frequency to once per day

Cron jobs **work on the free/Hobby plan**, but with restrictions. The Hobby plan limits cron execution to **once per day minimum** — any cron expression that would fire more frequently causes a deployment error. Timing precision is also reduced: a cron scheduled for 8:00 AM may fire anywhere within an **±59 minute window** (8:00–8:59). The Pro plan allows per-minute scheduling with per-minute precision. As of January 2026, all plans support **100 cron jobs per project** with no per-team limits. The cron feature itself is free on all plans; standard function invocation pricing applies to the underlying serverless function execution.

## BIGINT returns as a string, and Number.isFinite silently rejects it

Both **postgres.js** (the `postgres` npm package by porsager) and **@neondatabase/serverless** return BIGINT (int8) columns as **JavaScript strings** by default. This is because JavaScript's `Number` type cannot safely represent the full range of PostgreSQL's 64-bit integers (which go up to ~9.2 × 10¹⁸, while `Number.MAX_SAFE_INTEGER` is only ~9 × 10¹⁵). The drivers make a deliberate safety choice: `smallint` and `integer` columns return as JS numbers, but `bigint`, `numeric`, and `decimal` come back as strings.

**`Number.isFinite("3")` returns `false`.** Unlike the global `isFinite()` function, `Number.isFinite()` does not perform type coercion. It returns `true` only for values that are already of type `number` and are finite. A string input — even `"3"` — is rejected immediately. This means any code path that does `Number.isFinite(row.count)` where `count` comes from a `BIGINT` column (or from `count(*)`, which PostgreSQL types as `bigint`) will silently fail. The value is valid but the type check doesn't see it.

There are three practical fixes, ordered by recommendation:

- **SQL-level casting** is simplest and recommended by the postgres.js maintainer: write `count(*)::integer AS count` or `users_count::integer AS "count"` in the query. This changes the PostgreSQL column type from int8 (OID 20) to int4 (OID 23), and both postgres.js and @neondatabase/serverless have built-in parsers that convert int4 to a JS number. The caveat is that `::integer` will throw a PostgreSQL error if the value exceeds **2,147,483,647**, but for count results this is rarely an issue.
- **Driver-level type configuration** lets you override parsing globally. In postgres.js: `postgres({ types: { bigint: { to: 20, from: [20], parse: (v) => Number(v) } } })`. For @neondatabase/serverless in HTTP mode, pass a `types` option with a custom `getTypeParser`. For WebSocket mode, use `pg-types`: `types.setTypeParser(20, (v) => parseInt(v, 10))`.
- **Application-level conversion** with `Number(row.count)` or `parseInt(row.count, 10)` before using the value in comparisons. This is the most fragile approach since it requires remembering to convert everywhere.

## vercel.json must live in the configured Root Directory

Vercel reads **exactly one** vercel.json per project, and it must be in the directory configured as the project's **Root Directory** (set in Project Settings → Build & Deployment). If the Root Directory is set to `frontend/`, Vercel reads `frontend/vercel.json` and completely ignores any vercel.json at the repository root. If Root Directory is left as the default (repo root), the root-level vercel.json is used and `frontend/vercel.json` is ignored.

**Having two vercel.json files doesn't cause an explicit error** — Vercel simply ignores the one outside the Root Directory. But this is a treacherous misconfiguration: if crons are defined in the wrong vercel.json, they are never registered, and they silently never fire. There is no warning or error message. To verify which crons were actually registered during a build, run `vercel build --prod` locally and inspect `.vercel/output/config.json` for the `crons` property. The Vercel dashboard also shows registered crons under **Project Settings → Cron Jobs** — if the list is empty, the crons were never picked up from your vercel.json.

## How to debug crons that never fire

The primary debugging interface is the **Cron Jobs page** in Project Settings, which lists all registered cron jobs with a **"View Logs"** button (linking to runtime logs filtered by the cron's request path) and a **"Run"** button for manual triggering. The "Run" button is the most direct way to test — it fires the cron immediately from Vercel's infrastructure with the proper `CRON_SECRET` header.

**Vercel does not retry failed cron invocations.** If the endpoint returns a 401, 404, 500, or any other error status, Vercel records it and moves on. No retry, no alert (unless you've configured monitoring). Redirects (3xx) are also treated as final — crons do not follow redirects, and 3xx responses may not even appear in logs.

The ten most common reasons crons silently fail:

- **Wrong vercel.json location** — crons defined in the ignored file are never registered
- **Not deployed to production** — crons only fire on production deployments, never preview
- **Invalid CRON_SECRET** — special characters, trailing newlines, or copy-paste errors in the env var
- **Environment variable interpolation in path** — `$VAR` syntax doesn't work, sending literal strings
- **Static route compilation** — Next.js may compile the cron route as static, serving cached content instead of executing the handler; fix with `export const dynamic = 'force-dynamic'`
- **Trailing slash redirect** — a `trailingSlash: true` config causes a 308 redirect that crons don't follow
- **Route path mismatch** — the path in vercel.json doesn't match the actual API route file location
- **WAF/firewall rules** — custom firewall rules inadvertently blocking the cron user-agent
- **Hobby plan frequency limits** — scheduling more than once per day on Hobby causes a deployment error
- **Auth handler returning 404 instead of 401** — if the handler returns 404 for auth failures, it looks like a missing route rather than an auth problem in the logs

## The missing table scenario is the most likely failure mode

If a cron job is responsible for running `CREATE TABLE IF NOT EXISTS` and the cron has **never successfully authenticated**, the table will never be created. This is the most probable explanation for a missing table in this architecture. The failure chain is:

1. vercel.json has `"path": "/api/promagen-users/cron?secret=$PROMAGEN_CRON_SECRET"` — the `$PROMAGEN_CRON_SECRET` is sent as a literal string
2. The cron handler checks this query param against the real secret — it doesn't match
3. The handler returns 401 (or 404 if the auth check returns 404)
4. Vercel does not retry
5. `CREATE TABLE IF NOT EXISTS` never executes
6. All downstream queries against that table fail

**To fix this immediately:** Remove the query parameter approach entirely. Set a `CRON_SECRET` environment variable in the Vercel project dashboard, update the cron handler to check `request.headers.get('authorization')` against `Bearer ${process.env.CRON_SECRET}`, and simplify the vercel.json path to just `"/api/promagen-users/cron"`. Then manually trigger the cron using the "Run" button in Project Settings → Cron Jobs to create the table. Alternatively, hit the production endpoint directly with `curl -H "Authorization: Bearer YOUR_SECRET" https://your-app.vercel.app/api/promagen-users/cron`.

## Conclusion

Three independent issues compound here into a single debugging puzzle. **First**, Vercel's cron authentication works exclusively through the `CRON_SECRET` environment variable and Authorization header — not through query parameter interpolation, which doesn't exist. **Second**, postgres.js and Neon's serverless driver return BIGINT as strings, which silently breaks `Number.isFinite()` checks without any error or warning — the fix is either SQL casting with `::integer` or driver-level type configuration. **Third**, vercel.json placement in monorepos is governed entirely by the Root Directory setting, and a misplaced config file means crons are silently never registered. The combination of switching from `$PROMAGEN_CRON_SECRET` query params to the built-in `CRON_SECRET` header mechanism, adding `::integer` casts to BIGINT queries, and verifying vercel.json is in the correct Root Directory should resolve all of these issues.