# Potolok Planner — Codex instructions

## Project
Potolok Planner is a Russian-language web app for designing and estimating stretch ceilings.

## Stack
- Next.js 15 App Router
- React 19
- TypeScript
- CSS in `app/globals.css`
- Supabase client is available for cloud sync

## Development rules
- Keep the UI in Russian unless a feature explicitly requires another language.
- Prefer small, focused changes.
- Preserve existing geometry/calculation behavior when changing the UI.
- Keep client-only browser APIs (`localStorage`, `window`, `FileReader`) inside client components/effects.
- Do not expose Supabase service-role keys in client code; only public browser-safe configuration belongs in `NEXT_PUBLIC_*` variables.
- Before finishing a change, run the project's available build/type checks.

## Main areas
- `app/page.tsx` — main planner screen and interactions
- `app/components/` — planner UI panels/components
- `lib/geometry.ts` — room geometry calculations
- `lib/project.ts` — project persistence/import/export
- `lib/client.ts` — client (CRM) persistence, mirrors `project.ts`'s pattern
- `lib/sync.ts` — generic tombstone-aware Supabase table sync, used by `CloudSync.tsx` for both `projects` and `clients`
- `lib/catalog.ts` — materials/pricing catalog
