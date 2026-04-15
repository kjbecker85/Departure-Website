#!/usr/bin/env node
/**
 * Fetches relevant tweets for engagement opportunities.
 * Searches X for conversations about fitness apps, RPGs, gamified fitness, etc.
 * Stores results in Supabase for display in the admin dashboard.
 *
 * Usage:
 *   node scripts/fetch-engagement-targets.cjs
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { TwitterApi } = require("twitter-api-v2");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Search queries — rotate through these to find engagement opportunities
const SEARCH_QUERIES = [
  '"fitness app" -is:retweet lang:en',
  '"workout tracker" -is:retweet lang:en',
  '"fitness rpg" OR "gamified fitness" -is:retweet lang:en',
  '"workout motivation" looking for -is:retweet lang:en',
  '"gym app" recommend -is:retweet lang:en',
  '"fitness game" -is:retweet lang:en',
  '"workout app" -is:retweet lang:en',
  '"level up" gym OR fitness OR workout -is:retweet lang:en',
];

async function searchTweets(query) {
  // Use app-only (Bearer token) auth for search
  const client = new TwitterApi(process.env.X_API_KEY && process.env.X_API_SECRET ? {
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  } : '');

  try {
    const result = await client.v2.search(query, {
      max_results: 10,
      "tweet.fields": ["created_at", "public_metrics", "author_id"],
      "user.fields": ["username", "name", "public_metrics"],
      expansions: ["author_id"],
    });

    const users = {};
    if (result.includes?.users) {
      for (const u of result.includes.users) {
        users[u.id] = u;
      }
    }

    const tweets = [];
    if (result.data?.data) {
      for (const tweet of result.data.data) {
        const author = users[tweet.author_id];
        tweets.push({
          tweet_id: tweet.id,
          text: tweet.text,
          author_username: author?.username || "unknown",
          author_name: author?.name || "Unknown",
          author_followers: author?.public_metrics?.followers_count || 0,
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
          created_at: tweet.created_at,
          tweet_url: `https://x.com/${author?.username || "i"}/status/${tweet.id}`,
          search_query: query,
        });
      }
    }
    return tweets;
  } catch (err) {
    console.error(`Search failed for "${query}":`, err.message);
    return [];
  }
}

async function main() {
  console.log("Fetching engagement targets...\n");

  // Pick 3 random queries to avoid rate limits
  const shuffled = SEARCH_QUERIES.sort(() => Math.random() - 0.5);
  const queries = shuffled.slice(0, 3);

  let allTweets = [];
  for (const query of queries) {
    console.log(`Searching: ${query}`);
    const tweets = await searchTweets(query);
    console.log(`  Found ${tweets.length} tweets`);
    allTweets.push(...tweets);
  }

  // Deduplicate by tweet_id
  const seen = new Set();
  allTweets = allTweets.filter((t) => {
    if (seen.has(t.tweet_id)) return false;
    seen.add(t.tweet_id);
    return true;
  });

  // Sort by engagement potential (followers + likes)
  allTweets.sort((a, b) => (b.author_followers + b.likes * 10) - (a.author_followers + a.likes * 10));

  // Take top 15
  const top = allTweets.slice(0, 15);

  if (top.length === 0) {
    console.log("\nNo tweets found. API might be rate-limited.");
    return;
  }

  // Clear old targets and insert new ones
  await supabase.from("engagement_targets").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const rows = top.map((t) => ({
    tweet_id: t.tweet_id,
    tweet_text: t.text.substring(0, 500),
    author_username: t.author_username,
    author_name: t.author_name,
    author_followers: t.author_followers,
    likes: t.likes,
    retweets: t.retweets,
    replies: t.replies,
    tweet_url: t.tweet_url,
    search_query: t.search_query,
    tweeted_at: t.created_at,
    status: "new",
  }));

  const { data, error } = await supabase.from("engagement_targets").insert(rows);

  if (error) {
    console.error("Failed to save:", error.message);
  } else {
    console.log(`\nSaved ${top.length} engagement targets to Supabase.`);
    console.log("\nTop targets:");
    for (const t of top.slice(0, 5)) {
      console.log(`  @${t.author_username} (${t.author_followers} followers): ${t.text.substring(0, 80)}...`);
      console.log(`  ${t.tweet_url}\n`);
    }
  }
}

main();
