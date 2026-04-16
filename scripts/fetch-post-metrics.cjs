#!/usr/bin/env node
/**
 * Fetch engagement metrics for all posted content across X, Instagram, and Facebook.
 * Updates social_posts table with likes, comments, shares, retweets.
 *
 * Usage: node scripts/fetch-post-metrics.cjs
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { TwitterApi } = require("twitter-api-v2");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchXMetrics(posts) {
  const tweetIds = posts.filter((p) => p.x_post_id).map((p) => p.x_post_id);
  if (tweetIds.length === 0) return {};

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  const metrics = {};
  try {
    // Fetch in batches of 100 (API limit)
    for (let i = 0; i < tweetIds.length; i += 100) {
      const batch = tweetIds.slice(i, i + 100);
      const result = await client.v2.tweets(batch, {
        "tweet.fields": ["public_metrics"],
      });
      if (result.data) {
        for (const tweet of result.data) {
          metrics[tweet.id] = {
            x_likes: tweet.public_metrics?.like_count || 0,
            x_retweets: tweet.public_metrics?.retweet_count || 0,
            x_replies: tweet.public_metrics?.reply_count || 0,
          };
        }
      }
    }
    console.log(`  X: fetched metrics for ${Object.keys(metrics).length} tweets`);
  } catch (err) {
    console.error(`  X metrics error: ${err.message}`);
  }
  return metrics;
}

async function fetchIGMetrics(posts) {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) return {};

  const metrics = {};
  for (const post of posts) {
    if (!post.ig_post_id) continue;
    try {
      const res = await fetch(
        `https://graph.instagram.com/v21.0/${post.ig_post_id}?fields=like_count,comments_count&access_token=${token}`
      );
      const data = await res.json();
      if (!data.error) {
        metrics[post.ig_post_id] = {
          ig_likes: data.like_count || 0,
          ig_comments: data.comments_count || 0,
        };
      }
    } catch (err) {
      // Skip individual failures
    }
  }
  console.log(`  IG: fetched metrics for ${Object.keys(metrics).length} posts`);
  return metrics;
}

async function fetchFBMetrics(posts) {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) return {};

  const metrics = {};
  for (const post of posts) {
    if (!post.fb_post_id) continue;
    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${post.fb_post_id}?fields=likes.summary(true),comments.summary(true),shares&access_token=${token}`
      );
      const data = await res.json();
      if (!data.error) {
        metrics[post.fb_post_id] = {
          fb_likes: data.likes?.summary?.total_count || 0,
          fb_comments: data.comments?.summary?.total_count || 0,
          fb_shares: data.shares?.count || 0,
        };
      }
    } catch (err) {
      // Skip individual failures
    }
  }
  console.log(`  FB: fetched metrics for ${Object.keys(metrics).length} posts`);
  return metrics;
}

async function main() {
  console.log("Fetching post engagement metrics...\n");

  // Get all posted content
  const { data: posts, error } = await supabase
    .from("social_posts")
    .select("id, x_post_id, ig_post_id, fb_post_id, scheduled_date")
    .eq("status", "posted")
    .order("scheduled_date", { ascending: false });

  if (error || !posts?.length) {
    console.log("No posted content found.");
    return;
  }

  console.log(`Found ${posts.length} posted items. Fetching metrics...\n`);

  // Fetch from all platforms
  const [xMetrics, igMetrics, fbMetrics] = await Promise.all([
    fetchXMetrics(posts),
    fetchIGMetrics(posts),
    fetchFBMetrics(posts),
  ]);

  // Update each post
  let updated = 0;
  for (const post of posts) {
    const updates = { metrics_updated_at: new Date().toISOString() };

    if (post.x_post_id && xMetrics[post.x_post_id]) {
      Object.assign(updates, xMetrics[post.x_post_id]);
    }
    if (post.ig_post_id && igMetrics[post.ig_post_id]) {
      Object.assign(updates, igMetrics[post.ig_post_id]);
    }
    if (post.fb_post_id && fbMetrics[post.fb_post_id]) {
      Object.assign(updates, fbMetrics[post.fb_post_id]);
    }

    if (Object.keys(updates).length > 1) {
      await supabase.from("social_posts").update(updates).eq("id", post.id);
      updated++;
    }
  }

  console.log(`\nUpdated metrics for ${updated} posts.`);

  // Print summary
  let totalXLikes = 0, totalIGLikes = 0, totalFBLikes = 0;
  for (const m of Object.values(xMetrics)) totalXLikes += m.x_likes;
  for (const m of Object.values(igMetrics)) totalIGLikes += m.ig_likes;
  for (const m of Object.values(fbMetrics)) totalFBLikes += m.fb_likes;

  console.log(`\nEngagement summary:`);
  console.log(`  X:  ${totalXLikes} likes, ${Object.values(xMetrics).reduce((a, m) => a + m.x_retweets, 0)} retweets, ${Object.values(xMetrics).reduce((a, m) => a + m.x_replies, 0)} replies`);
  console.log(`  IG: ${totalIGLikes} likes, ${Object.values(igMetrics).reduce((a, m) => a + m.ig_comments, 0)} comments`);
  console.log(`  FB: ${totalFBLikes} likes, ${Object.values(fbMetrics).reduce((a, m) => a + m.fb_comments, 0)} comments, ${Object.values(fbMetrics).reduce((a, m) => a + m.fb_shares, 0)} shares`);
}

main();
