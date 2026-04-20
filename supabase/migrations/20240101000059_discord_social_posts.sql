-- Add Discord webhook posting columns to social_posts.
-- discord_posted tracks whether the daily post was sent to the Discord channel.
-- discord_post_id stores the composite ID returned by post-discord.cjs
-- (webhookId-timestamp, since Discord webhook 204 responses carry no message ID).

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS discord_posted  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS discord_post_id text;
