# Quantroom — private CAT QA sectionals

An invite-only Next.js platform for fixed 22-question QA sectionals, individual 40-minute sittings, autosave, private attempt analysis, and organizer-managed question imports.

## Data and privacy

- The supplied bank is kept out of Git. `data/question-bank.json` is ignored and used only for local preview/import.
- Run `node scripts/prepare-bank.mjs <source-file> data/question-bank.json` to make a safe normalized bank. The normalizer discards the source mock's personal answer, result, mark, and time fields.
- Postgres separates question stems from answer keys. During an active sitting, the browser receives stems and choices only.
- RLS scopes attempts and event rows to `auth.uid()`. Organizer APIs manage questions, forms, and invitations; none query participant attempts.
- A one-time organizer token bootstraps the first owner invitation. Members are then invited from the organizer screen.

## Supabase setup

1. Create a Supabase project and run `database/migrations/001_platform.sql` in its SQL Editor.
2. Set the four values in `.env.local` (see `.env.example`): project URL, publishable/anon key, server-only service role key, and a long random `OWNER_SETUP_TOKEN`.
3. Seed the bank from the normalized private JSON with `node scripts/seed-supabase.mjs`. This script sends only question content and metadata; it does not send the original personal attempt fields.
4. Add the deployed domain and `/auth/callback` to Supabase Auth's allowed redirect URLs. Disable open sign-ups; invitations create member accounts.

Keep `SUPABASE_SERVICE_ROLE_KEY` and `OWNER_SETUP_TOKEN` server-only. Never prefix them with `NEXT_PUBLIC_` or commit `.env.local`.

## Vercel

Import this repository as a Next.js project and set the same four environment variables in Vercel. The question bank is in Supabase, not in the repository. Once deployed, visit `/setup`, enter the organizer email and one-time setup code, and accept the invitation from that mailbox. After sign-in, import/manage the bank, preview the form mix, publish, and invite friends.

## Product rules

- 22 questions; 40 minutes; +3 correct, −1 wrong MCQ, 0 wrong TITA or blank.
- Exact target mix: 6 A / 10 B / 6 C. Form generation uses each question once and aims at the stated five-year CAT topic shares.
- P-values are preserved as supplied. Combined values are not split into unsupported attempt/accuracy rates.
- Reports cover overview, score, journey, time, selection, insights, mistakes, and question review. A correct timed retry counts as potentially recoverable only if the solution had not been opened first.
- No group score view, leaderboard, or unsupported percentile claim.

## Local development

```bash
npm install
npm run dev
```

Without Supabase variables the app renders a local preview from `data/question-bank.json`; tests and member accounts require Supabase configuration.
