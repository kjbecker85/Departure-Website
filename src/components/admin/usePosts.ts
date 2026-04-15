import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

export interface SocialPost {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  post_type: string;
  image_path: string | null;
  x_text: string | null;
  ig_text: string | null;
  status: 'upcoming' | 'posted' | 'skipped' | 'failed';
  x_posted: boolean;
  ig_posted: boolean;
  x_post_id: string | null;
  ig_post_id: string | null;
  posted_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface PostingSchedule {
  id: number;
  default_time: string;
  frequency: 'daily' | 'weekdays' | 'custom';
  custom_days: number[];
  timezone: string;
  paused: boolean;
}

export function usePosts() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [schedule, setSchedule] = useState<PostingSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('social_posts')
      .select('*')
      .order('scheduled_date', { ascending: true });

    if (!error && data) setPosts(data);
  }, []);

  const fetchSchedule = useCallback(async () => {
    const { data, error } = await supabase
      .from('posting_schedule')
      .select('*')
      .eq('id', 1)
      .single();

    if (!error && data) setSchedule(data);
  }, []);

  useEffect(() => {
    Promise.all([fetchPosts(), fetchSchedule()]).then(() => setLoading(false));
  }, [fetchPosts, fetchSchedule]);

  async function updatePost(id: string, updates: Partial<SocialPost>) {
    const { error } = await supabase
      .from('social_posts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) await fetchPosts();
    return error;
  }

  async function skipPost(id: string) {
    return updatePost(id, { status: 'skipped' });
  }

  async function retryPost(id: string) {
    return updatePost(id, { status: 'upcoming', error_message: null });
  }

  async function reschedulePost(id: string, newDate: string) {
    return updatePost(id, { scheduled_date: newDate });
  }

  async function updateSchedule(updates: Partial<PostingSchedule>) {
    const { error } = await supabase
      .from('posting_schedule')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (!error) await fetchSchedule();
    return error;
  }

  return {
    posts,
    schedule,
    loading,
    updatePost,
    skipPost,
    retryPost,
    reschedulePost,
    updateSchedule,
    refreshPosts: fetchPosts,
  };
}
