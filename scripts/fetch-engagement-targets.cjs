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

/**
 * Generate a contextual reply suggestion based on tweet content.
 * Uses keyword matching to create relevant, non-spammy replies.
 */
function generateReply(tweetText, query, authorUsername) {
  const text = tweetText.toLowerCase();

  // Reply templates by topic
  const templates = {
    recommendation: [
      `We're building exactly this — a fitness RPG where your workouts earn XP, you rank up, and your team fights monsters. Launching soon: departure.engagequalia.com`,
      `If you're looking for something that makes workouts actually fun — we're building Departure. Real workout tracking + RPG progression + team battles. Coming soon 🗡️`,
      `Check out what we're working on — real sets/reps/weight tracking with XP, rank-ups, equipment drops, and team monster battles. departure.engagequalia.com`,
    ],
    gamified: [
      `Love seeing gamified fitness grow! We're taking it further with Departure — 24 monsters to fight, team battles, equipment drops, and AI body transformation. The grind is real 🗡️`,
      `Gamified fitness is the future. We're building Departure — every workout earns XP, your team fights through 24 bosses, and you see your AI future self. departure.engagequalia.com`,
      `This is exactly why we built Departure — real workout tracking meets RPG progression. 24 rank tiers, team battles, loot drops. Coming soon to iOS & Android.`,
    ],
    motivation: [
      `That's the energy 💪 We're building an app where that motivation turns into XP, rank-ups, and your team fighting monsters together. Departure — launching soon.`,
      `Love this. Every rep should feel like it matters. In Departure, it literally does — XP, PRs, rank progression, and team monster battles. departure.engagequalia.com`,
      `This is what it's about. We built Departure to make every workout count — earn XP, rank up through 24 tiers, battle monsters with your team. Coming soon 🗡️`,
    ],
    app: [
      `We're building something you might like — Departure turns real workouts into an RPG. Track sets/reps/weight, earn XP, rank up, fight monsters with your team. Free to play.`,
      `If you want a workout tracker that's actually fun — check out Departure. RPG progression, team monster battles, AI body transformation, anti-cheat system. departure.engagequalia.com`,
      `Real tracking (88+ exercises, auto PR detection) + RPG fun (XP, ranks, monster battles, loot). That's Departure. Coming soon to iOS & Android.`,
    ],
    fitness_game: [
      `Making fitness a game is literally what we do 🎮💪 Departure: your workouts earn XP, your team fights 24 bosses, and you equip legendary gear. departure.engagequalia.com`,
      `Fitness as a game > fitness as a chore. We're building Departure — RPG progression, team battles, equipment drops, all powered by your real workouts.`,
      `The best fitness game is the one that actually makes you go to the gym. We're building that. departure.engagequalia.com`,
    ],
    generic: [
      `This caught our eye 👀 We're building Departure — a fitness RPG where your real workouts power the adventure. 24 monsters, team battles, AI transformation. departure.engagequalia.com`,
      `Love the fitness energy here. We're building something you might dig — Departure turns real workouts into RPG progression with team monster battles. Coming soon 🗡️`,
      `The fitness community never stops inspiring. We're adding RPG fuel to the fire with Departure — XP, ranks, monster battles, all powered by real workouts.`,
    ],
  };

  // Determine best category
  let category = "generic";
  if (text.includes("recommend") || text.includes("looking for") || text.includes("suggest") || text.includes("best app")) {
    category = "recommendation";
  } else if (text.includes("gamif") || text.includes("rpg") || text.includes("level up") || text.includes("xp")) {
    category = "gamified";
  } else if (text.includes("motiv") || text.includes("stepping up") || text.includes("grind") || text.includes("pushing")) {
    category = "motivation";
  } else if (text.includes("app") || text.includes("tracker") || text.includes("track")) {
    category = "app";
  } else if (text.includes("game") || text.includes("play")) {
    category = "fitness_game";
  }

  const options = templates[category];
  const reply = options[Math.floor(Math.random() * options.length)];
  return reply;
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
    suggested_reply: generateReply(t.text, t.search_query, t.author_username),
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
