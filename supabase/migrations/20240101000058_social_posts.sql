-- Social media posting dashboard tables
-- Used by the /admin dashboard and GitHub Actions posting pipeline

-- Helper: check if authenticated user is a Qualia employee
CREATE OR REPLACE FUNCTION public.is_qualia_employee()
RETURNS boolean AS $$
BEGIN
  RETURN (
    SELECT email LIKE '%@engagequalia.com'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Social posts content queue
CREATE TABLE public.social_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL DEFAULT '10:03:00',
  post_type text NOT NULL CHECK (post_type IN ('feature', 'monster', 'engagement', 'announcement')),
  image_path text,
  x_text text,
  ig_text text,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'posted', 'skipped', 'failed')),
  x_posted boolean DEFAULT false,
  ig_posted boolean DEFAULT false,
  x_post_id text,
  ig_post_id text,
  posted_at timestamptz,
  error_message text,
  retry_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_social_posts_date ON social_posts (scheduled_date);
CREATE INDEX idx_social_posts_status ON social_posts (status);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

-- Qualia employees: full CRUD
CREATE POLICY "Qualia employees can read social_posts"
  ON social_posts FOR SELECT USING (public.is_qualia_employee());
CREATE POLICY "Qualia employees can insert social_posts"
  ON social_posts FOR INSERT WITH CHECK (public.is_qualia_employee());
CREATE POLICY "Qualia employees can update social_posts"
  ON social_posts FOR UPDATE USING (public.is_qualia_employee());
CREATE POLICY "Qualia employees can delete social_posts"
  ON social_posts FOR DELETE USING (public.is_qualia_employee());

-- Posting schedule config (singleton row)
CREATE TABLE public.posting_schedule (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_time time NOT NULL DEFAULT '10:03:00',
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'custom')),
  custom_days integer[] DEFAULT '{0,1,2,3,4,5,6}',
  timezone text NOT NULL DEFAULT 'America/New_York',
  paused boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE posting_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualia employees can read posting_schedule"
  ON posting_schedule FOR SELECT USING (public.is_qualia_employee());
CREATE POLICY "Qualia employees can update posting_schedule"
  ON posting_schedule FOR UPDATE USING (public.is_qualia_employee());

-- Seed default schedule
INSERT INTO posting_schedule (id, default_time, frequency, timezone, paused)
VALUES (1, '10:03:00', 'daily', 'America/New_York', false);
