import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xutgzsdqhacbkhmxsinr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1dGd6c2RxaGFjYmtobXhzaW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NzQ2MzcsImV4cCI6MjA5MDU1MDYzN30.nCNQvhfG1NzlWEO4UvwRHdhYRVvn2-YaAKrGR7FFUA8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
