# Departure Website

Marketing/landing site for **Departure: Fitness Quest** — a fitness RPG app by Qualia Consulting.
The app combines real workout tracking with RPG progression, team monster battles, and AI body transformation.
Currently in pre-launch: Google Play beta live, iOS coming soon.

## Stack
- Astro 6 + Tailwind CSS 4 (via `@tailwindcss/vite`, not `@astrojs/tailwind`)
- Node >= 22.12 required
- `"type": "module"` (ESM) in package.json

## Commands
- `npm run dev` — dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build

## Structure
- `src/pages/` — site pages (index, features, gallery, pricing, about)
- `src/components/` — Astro components (PhoneMockup, etc.)
- `src/layouts/Layout.astro` — shared layout
- `scripts/*.cjs` — social media posting scripts (CommonJS, require .env for API keys)
- `marketing/` — content drafts (ASO, social posts, Product Hunt, Discord setup)
- `public/` — static assets and screenshots

## Notes
- Scripts in `scripts/` are `.cjs` despite ESM project — they run standalone outside Astro
- Working directory path contains spaces — quote paths in shell commands
- Email capture currently uses localStorage (TODO: connect to Tally/Supabase)
- `.env` is gitignored — needed for social posting scripts (X/Instagram API keys)
- No test framework configured

## Social Posting Pipeline
- `content-queue.json` is source of truth for `image_path`; DB `x_text`/`ig_text`/`fb_text` differ (CTA appended) — never overwrite text from queue
- IG tokens prefixed `IGAAZ` only work on `graph.instagram.com`, NOT `graph.facebook.com`
- IG container creation requires explicit `media_type: "IMAGE"` in POST body or API rejects with "Only photo or video"
- X posting uses local file path; IG/FB require public URL (`SITE_BASE + "/" + image_path`)
- Retry a failed platform without re-posting X: use `--only-platforms ig,fb` (no spaces in value)
- `scripts/sync-queue.cjs` audits image_path drift between queue and DB — run after any bulk edit; `--apply` fixes upcoming/failed rows
- Supabase row marked "posted" if ANY platform succeeds — check `x_posted`/`ig_posted`/`fb_posted` bool columns for per-platform status
- GitHub Actions workflow supports `only_platforms` input for partial retries; always quote the value in shell: `"${{ github.event.inputs.only_platforms }}"`
