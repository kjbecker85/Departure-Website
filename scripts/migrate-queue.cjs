#!/usr/bin/env node
/**
 * One-time migration: content-queue.json → Supabase social_posts table.
 * Uses the service role key to bypass RLS.
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const queuePath = path.resolve(__dirname, "../content-queue.json");
  const queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));

  console.log(`Migrating ${queue.length} posts from content-queue.json → Supabase...\n`);

  const rows = queue.map((post) => ({
    scheduled_date: post.date,
    scheduled_time: "10:03:00",
    post_type: post.type || "feature",
    image_path: post.image,
    x_text: post.x_text,
    ig_text: post.ig_text,
    status: post.skip ? "skipped" : post.posted ? "posted" : "upcoming",
    x_posted: post.x_posted || false,
    ig_posted: post.ig_posted || false,
    x_post_id: null,
    ig_post_id: null,
    posted_at: post.posted_at || null,
    error_message: null,
    retry_count: 0,
  }));

  const { data, error } = await supabase.from("social_posts").insert(rows).select();

  if (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }

  const posted = data.filter((r) => r.status === "posted").length;
  const upcoming = data.filter((r) => r.status === "upcoming").length;
  const skipped = data.filter((r) => r.status === "skipped").length;

  console.log(`Migrated ${data.length} posts:`);
  console.log(`  Posted: ${posted}`);
  console.log(`  Upcoming: ${upcoming}`);
  console.log(`  Skipped: ${skipped}`);
  console.log("\nDone!");
}

main();
