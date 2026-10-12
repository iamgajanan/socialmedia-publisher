# Phase 32 — Production schema reconciliation runbook

This is an operational release gate. Passing CI proves the repository changes compile and pass automated tests; it does not prove that the target Supabase database has the expected migration history or schema.

## Safety rules

- Confirm the exact OmniSocial Supabase project ref and project name before running any command. Do not infer it from unrelated projects.
- Take/verify a recoverable database backup and establish a rollback/forward-fix plan before applying DDL.
- Do not run a migration against production until the preflight below passes.
- Inspect the linked migration history first. If the Phase 32 migration is already recorded as applied but the schema is incomplete, **do not edit/re-run that historical migration**. Create a new forward-only corrective migration instead.
- Never reset production, use `db reset`, or delete workspace/API-key data to force migrations through.
- Do not paste service-role keys, database passwords, or connection strings into source control, CI logs, or chat.

## 1. Confirm the target project

Use the Supabase dashboard to verify the project name, project ref, region, and production environment. Then link the local repository to that exact project:

```sh
supabase login
supabase link --project-ref <CONFIRMED_OMNISOCIAL_PROJECT_REF>
```

Do not proceed if the project identity is ambiguous.

## 2. Inspect migration history and proposed changes

```sh
supabase migration list --linked
supabase db push --dry-run
```

Review the full output. Confirm whether `202610080002_phase32_multitenant_branding_usage.sql` is pending or already recorded as applied. Do not blindly reapply it.

## 3. Run the read-only data preflight

Open `supabase/verification/phase32_preflight.sql` in the SQL editor for the confirmed project and execute it. It only reads schema/data and raises an exception if required tables/columns or profile-to-workspace relationships are missing or inconsistent. It also checks partial Phase 32 state for duplicate slugs/domains, invalid branding colours, orphan workspace IDs, and variants assigned to a different workspace than their parent generation.

If it fails, stop and repair the reported rows/schema with a separately reviewed, reversible plan. Do not bypass the preflight.

## 4. Apply only the reviewed pending migration

Only if the migration is genuinely pending, the preflight passes, and the backup/rollback plan is ready:

```sh
supabase db push
```

Watch the complete output. Stop on any error. Do not continue to application smoke tests if the migration fails.

If the migration is already marked applied but required objects are missing, write and review a new forward-only migration with a new timestamp, run it through CI, then apply that new migration. Do not alter migration history manually to make the tool appear green.

## 5. Verify schema and permissions

Run `supabase/verification/phase32_schema_check.sql` against the same project. It must finish without raising an exception. Also verify the migration list again and review Supabase security/performance advisors.

The migration creates a private, non-exposed workspace-membership helper before installing usage-table RLS; the helper pins an empty search path, derives identity only from auth.uid(), and is not executable by anon. The follow-up private-usage-RPC migration moves workspace aggregate reporting out of the exposed public schema. The verification SQL checks required columns, constraints, indexes, usage-table RLS, function definitions, helper/RPC execution grants, and security modes. The preflight and verification scripts are read-only.

## 6. Application smoke tests

After schema verification succeeds, test in a staging/controlled account before customer traffic:

- Create, list, use, and revoke an API key; confirm request usage is counted only after successful authentication/rate-limit checks.
- Switch between two workspaces and verify branding, AI history, variants, and approvals remain tenant-scoped.
- Confirm existing OAuth connections, publishing, scheduling, retries, media, and workspace membership still work.
- Inspect application logs for missing-column/RPC errors and monitor failed API requests.

## Completion criteria

Mark this release gate complete only when all of the following are recorded:

- [ ] Correct production project identity confirmed.
- [ ] Backup/rollback plan verified.
- [ ] Migration history reviewed; no blind reapplication.
- [ ] Read-only preflight passed.
- [ ] Pending migration applied successfully, or a forward-only repair applied if history was already marked complete.
- [ ] Read-only schema verification passed.
- [ ] Application smoke tests passed and logs show no new schema errors.

Until these are complete, the code change may be merged and CI-green while production schema reconciliation remains **incomplete**.
