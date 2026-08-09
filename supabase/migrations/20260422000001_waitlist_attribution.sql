-- Capture paid-ads + organic attribution on waitlist signups.
-- All columns nullable so existing inserts without UTMs keep working.
-- Columns mirror what's stashed in sessionStorage by Layout.astro's
-- first-touch capture snippet and submitted by src/pages/index.astro.

ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS utm_source    text,
  ADD COLUMN IF NOT EXISTS utm_medium    text,
  ADD COLUMN IF NOT EXISTS utm_campaign  text,
  ADD COLUMN IF NOT EXISTS utm_content   text,
  ADD COLUMN IF NOT EXISTS utm_term      text,
  ADD COLUMN IF NOT EXISTS gclid         text,
  ADD COLUMN IF NOT EXISTS fbclid        text,
  ADD COLUMN IF NOT EXISTS ttclid        text,
  ADD COLUMN IF NOT EXISTS referrer      text,
  ADD COLUMN IF NOT EXISTS landing_page  text;

-- Indexes for common reporting queries (campaign-level rollups).
CREATE INDEX IF NOT EXISTS waitlist_signups_utm_source_idx
  ON public.waitlist_signups (utm_source);
CREATE INDEX IF NOT EXISTS waitlist_signups_utm_campaign_idx
  ON public.waitlist_signups (utm_campaign);
