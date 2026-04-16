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

// Exclude our own accounts from results
const EXCLUDED_ACCOUNTS = ["DepartureFit", "departure_fitness"];

// Search queries — broad pool, rotate 4 per run
const SEARCH_QUERIES = [
  '"fitness app" -from:DepartureFit -is:retweet lang:en',
  '"workout tracker" -from:DepartureFit -is:retweet lang:en',
  '"fitness rpg" OR "gamified fitness" -from:DepartureFit -is:retweet lang:en',
  '"gym app" -from:DepartureFit -is:retweet lang:en',
  '"fitness game" -from:DepartureFit -is:retweet lang:en',
  '"workout app" -from:DepartureFit -is:retweet lang:en',
  'fitness motivation gym gains -from:DepartureFit -is:retweet lang:en',
  'new fitness app launch -from:DepartureFit -is:retweet lang:en',
  'best gym app 2026 -from:DepartureFit -is:retweet lang:en',
  'workout challenge accountability -from:DepartureFit -is:retweet lang:en',
  'gym buddy partner workout -from:DepartureFit -is:retweet lang:en',
  'fitness tech wearable app -from:DepartureFit -is:retweet lang:en',
  'personal record PR gym -from:DepartureFit -is:retweet lang:en',
  'bodybuilding app track -from:DepartureFit -is:retweet lang:en',
  'CrossFit WOD app -from:DepartureFit -is:retweet lang:en',
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

// Full image pool by category. Every social image is used somewhere.
const REPLY_IMAGES = {
  recommendation: [
    "social/home-screen.jpg", "social/workout-log.jpg", "social/exercise-picker.jpg",
    "social/training-log.jpg", "social/onboarding.jpg", "social/challenges.jpg",
  ],
  gamified: [
    "social/monster-lich-king.jpg", "social/monster-kraken.jpg", "social/monster-orc-berserker.jpg",
    "social/monster-frost-giant.jpg", "social/monster-dark-sorcerer.jpg", "social/monster-bone-colossus.jpg",
    "social/monster-minotaur-champion.jpg", "social/team-journey.jpg", "social/ranks.jpg",
  ],
  motivation: [
    "social/transformation.jpg", "social/home-warlord.jpg", "social/ranks.jpg",
    "social/monster-dire-wolf-pack.jpg", "social/monster-orc-warchief.jpg", "social/challenges.jpg",
  ],
  app: [
    "social/home-screen.jpg", "social/exercise-picker.jpg", "social/training-log.jpg",
    "social/workout-log.jpg", "social/onboarding.jpg", "social/anti-cheat.jpg",
    "social/challenges.jpg",
  ],
  fitness_game: [
    "social/monster-goblin-scout.jpg", "social/monster-skeleton-warrior.jpg",
    "social/monster-dire-wolf-pack.jpg", "social/monster-goblin-shaman.jpg",
    "social/monster-forest-spider.jpg", "social/monster-stone-golem.jpg",
    "social/monster-swamp-rat.jpg", "social/battle-results.jpg",
    "social/equipment.jpg", "social/team-journey.jpg",
  ],
  team: [
    "social/team-walkers.jpg", "social/team-walkers.jpg", "social/team-walkers.jpg",
    "social/team-journey.jpg", "social/battle-results.jpg",
  ],
  loot: [
    "social/equipment.jpg", "social/shop-armory.jpg", "social/premium-store.jpg",
    "social/monster-minotaur-champion.jpg",
  ],
  generic: [
    "social/home-screen.jpg", "social/monster-lich-king.jpg", "social/team-journey.jpg",
    "social/transformation.jpg", "social/monster-kraken.jpg", "social/ranks.jpg",
    "social/monster-frost-giant.jpg", "social/exercise-picker.jpg", "social/battle-results.jpg",
    "social/equipment.jpg", "social/home-warlord.jpg", "social/monster-orc-berserker.jpg",
  ],
};

// ~75% of replies get an image
const IMAGE_PROBABILITY = 0.75;

/**
 * Generate a contextual reply suggestion based on tweet content.
 * Returns { reply, image } where image may be null.
 */
function generateReply(tweetText, query, authorUsername) {
  const text = tweetText.toLowerCase();

  const templates = {
    recommendation: [
      `We're building exactly this. A fitness RPG where your workouts earn XP, you rank up, and your team fights monsters. Free to play. departure.engagequalia.com`,
      `You might want to check out Departure. Real workout tracking with RPG progression, team monster battles, and loot drops. Launching soon 🗡️`,
      `If you're looking for something that makes the gym actually fun, we got you. Departure tracks real sets/reps/weight and turns it into an RPG adventure.`,
      `Sounds like you'd love what we're building. Departure is a fitness RPG. Your workouts earn XP, you rank up, and your team battles through 24 monsters together.`,
      `Dropping this here because it sounds like what you need. Departure: real workout tracker + RPG progression + team battles. departure.engagequalia.com`,
      `We built Departure for exactly this. 88+ exercises, auto PR detection, XP system, 24 rank tiers, team monster battles. All free. Coming soon to iOS & Android.`,
      `Have you tried turning your workouts into a literal RPG? That's what Departure does. Real tracking, real progression, real monster fights with your team.`,
    ],
    gamified: [
      `Love seeing gamified fitness grow! We're taking it further with Departure. 24 monsters to fight, team battles, equipment drops, and AI body transformation 🗡️`,
      `This is exactly why we built Departure. Real workout tracking meets RPG progression. 24 rank tiers, team battles, loot drops. Coming soon.`,
      `Gamified fitness is the move. We went all in on it. Departure has XP, ranks, monster battles, loot drops, team combat. Powered by your actual workouts.`,
      `The intersection of fitness and gaming is where it's at. Departure turns your gym sessions into boss fights. 24 monsters, 6 worlds, your team vs the journey.`,
      `Yes! More of this. We built an entire RPG around real workouts. Your bench press literally fuels your team's combat power. departure.engagequalia.com`,
      `Gamified fitness done right means the game can't exist without the workout. That's Departure. No fake reps, no shortcuts. Your gym time IS the gameplay.`,
    ],
    motivation: [
      `That's the energy 💪 We built an app where that motivation turns into XP, rank ups, and monster kills with your team. Departure is launching soon.`,
      `Love this. Every rep should feel like progress. In Departure, it literally is. XP, PRs, rank progression, and team monster battles. departure.engagequalia.com`,
      `This is what it's about. We built Departure to make every workout count. Earn XP, rank up through 24 tiers, battle monsters with your team 🗡️`,
      `That grind mentality is exactly what Departure rewards. Every set, every rep earns XP. Your team needs you showing up. 24 bosses won't beat themselves.`,
      `Keep that energy. We built Departure so your workouts actually lead somewhere. XP, ranks, team battles, equipment drops. Your consistency is your weapon.`,
      `Respect the dedication. We're building Departure to turn that effort into something tangible. RPG progression powered by your real training.`,
      `The gym is already a boss fight. We just made it official. Departure tracks your workouts and turns them into an actual RPG adventure with your friends.`,
    ],
    app: [
      `We're building something you might like. Departure turns real workouts into an RPG. Track sets/reps/weight, earn XP, fight monsters with your team. Free to play.`,
      `If you want a workout tracker that's actually fun, check out Departure. RPG progression, team monster battles, AI body transformation. departure.engagequalia.com`,
      `Real tracking (88+ exercises, auto PR detection) + RPG mechanics (XP, ranks, battles, loot). That's Departure. Coming soon to iOS & Android.`,
      `Most fitness apps are either good trackers or good games. We're building both. Departure: real sets/reps/weight + XP, ranks, team battles, equipment drops.`,
      `We track the boring stuff (sets, reps, weight, PRs, training splits) and make it not boring (XP, monster battles, loot drops, team combat). departure.engagequalia.com`,
      `Departure does the tracking right. 88+ exercises, 10 categories, auto PR detection, training calendar. But also: XP, 24 rank tiers, and team monster battles.`,
      `Workout tracking shouldn't feel like homework. Departure tracks everything you need and wraps it in an RPG where your team fights through 24 bosses together.`,
    ],
    fitness_game: [
      `Making fitness a game is literally what we do 🎮💪 Your workouts earn XP, your team fights 24 bosses, you equip legendary gear. departure.engagequalia.com`,
      `Fitness as a game > fitness as a chore. Departure has RPG progression, team battles, equipment drops, all powered by your real workouts.`,
      `The best fitness game is the one that actually makes you go to the gym. That's what we're building. departure.engagequalia.com`,
      `We turned the gym into a 24 boss RPG. Your workouts are the combat. Your team needs you to show up. Departure is coming soon to iOS & Android.`,
      `Fitness + gaming = Departure. Real workout tracking, real XP, real monster battles with your friends. Not a gimmick. An actual RPG powered by your training.`,
      `Every leg day is a boss fight. Every PR is a rank up. Every gym session drops loot. That's Departure. departure.engagequalia.com`,
      `We didn't just gamify fitness. We built a full RPG around it. 24 monsters, 6 worlds, team combat, equipment crafting. All fueled by your actual workouts.`,
    ],
    team: [
      `The gym is better with a squad. Departure lets your team fight through 24 monsters together. Every member's workouts contribute to combat power.`,
      `Your gym partner is about to become your raid partner. Departure: team monster battles powered by real workouts. departure.engagequalia.com`,
      `We built Departure for gym crews. Your team picks a genre (Barbarian, Samurai, Cyberpunk), then battles through 24 bosses. Everyone's workouts fuel the fight.`,
      `Solo grind or team mode. Departure works both ways, but the team battles are where it gets real. 24 bosses, your squad's workouts vs the monster.`,
    ],
    loot: [
      `Imagine getting a legendary equipment drop after leg day. That's Departure. Your workouts have a chance to drop gear across 5 rarity tiers.`,
      `We added loot drops to gym sessions. 5 rarity tiers, 9 gear slots, each piece boosts your team's combat power. Departure is launching soon 🗡️`,
      `The best loot system in fitness. Your workouts drop equipment. Common to Legendary. Each piece makes your team hit harder in monster battles.`,
    ],
    generic: [
      `This caught our eye 👀 We're building Departure, a fitness RPG where your real workouts power the adventure. 24 monsters, team battles, AI transformation.`,
      `Love the fitness energy here. We're building Departure. It turns real workouts into RPG progression with team monster battles. Coming soon 🗡️`,
      `The fitness community never stops inspiring. We're adding RPG fuel to the fire with Departure. XP, ranks, monster battles, all powered by real workouts.`,
      `Dropping by because the vibes are right. We built Departure to make fitness feel like an adventure. Your workouts earn XP, your team fights monsters.`,
      `Big fan of this. We're building something in this space. Departure is a fitness RPG where your real gym sessions power team monster battles. departure.engagequalia.com`,
      `Respect 💪 If you're into fitness and gaming, check out what we're building. Departure turns workouts into an RPG with 24 bosses and team combat.`,
      `This is the content we love to see. We're building Departure to bring this energy into a full RPG experience. Your workouts, your team, your journey.`,
      `We're out here building the gym RPG nobody asked for but everybody needs. 24 monsters, team battles, loot drops, all powered by real workouts. departure.engagequalia.com`,
    ],
  };

  // Determine best category with more keywords
  let category = "generic";
  if (text.includes("recommend") || text.includes("looking for") || text.includes("suggest") || text.includes("best app") || text.includes("any good") || text.includes("which app")) {
    category = "recommendation";
  } else if (text.includes("gamif") || text.includes("rpg") || text.includes("level up") || text.includes("xp") || text.includes("points") || text.includes("badges")) {
    category = "gamified";
  } else if (text.includes("team") || text.includes("partner") || text.includes("buddy") || text.includes("squad") || text.includes("crew") || text.includes("together")) {
    category = "team";
  } else if (text.includes("loot") || text.includes("drop") || text.includes("equip") || text.includes("gear") || text.includes("reward")) {
    category = "loot";
  } else if (text.includes("motiv") || text.includes("stepping up") || text.includes("grind") || text.includes("pushing") || text.includes("gains") || text.includes("beast mode") || text.includes("no excuses")) {
    category = "motivation";
  } else if (text.includes("app") || text.includes("tracker") || text.includes("track") || text.includes("log")) {
    category = "app";
  } else if (text.includes("game") || text.includes("play") || text.includes("fun")) {
    category = "fitness_game";
  }

  const options = templates[category];
  const reply = options[Math.floor(Math.random() * options.length)];

  // Pick image (75% chance)
  let image = null;
  if (Math.random() < IMAGE_PROBABILITY) {
    const images = REPLY_IMAGES[category] || REPLY_IMAGES.generic;
    image = images[Math.floor(Math.random() * images.length)];
  }

  return { reply, image };
}

async function main() {
  console.log("Fetching engagement targets...\n");

  // Pick 4 random queries to maximize results
  const shuffled = SEARCH_QUERIES.sort(() => Math.random() - 0.5);
  const queries = shuffled.slice(0, 4);

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

  // Filter out low-follower accounts (minimum 100 followers)
  const MIN_FOLLOWERS = 100;
  allTweets = allTweets.filter((t) => t.author_followers >= MIN_FOLLOWERS);
  console.log(`After follower filter (${MIN_FOLLOWERS}+): ${allTweets.length} tweets`);

  // Sort by engagement potential (followers + likes)
  allTweets.sort((a, b) => (b.author_followers + b.likes * 10) - (a.author_followers + a.likes * 10));

  // Get previously seen tweet IDs (engaged, skipped, or already shown)
  const { data: previousTargets } = await supabase
    .from("engagement_targets")
    .select("tweet_id");
  const previousIds = new Set((previousTargets || []).map((t) => t.tweet_id));

  // Filter out previously seen tweets and our own accounts
  allTweets = allTweets.filter((t) =>
    !previousIds.has(t.tweet_id) &&
    !EXCLUDED_ACCOUNTS.some((a) => a.toLowerCase() === t.author_username.toLowerCase())
  );
  console.log(`After dedup with history: ${allTweets.length} new tweets`);

  // Take top 15
  const top = allTweets.slice(0, 15);

  if (top.length === 0) {
    console.log("\nNo new tweets found. All results were previously shown.");
    return;
  }

  // Delete old "new" targets only (keep engaged/skipped as history)
  await supabase.from("engagement_targets").delete().eq("status", "new");

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
    ...(() => {
      const { reply, image } = generateReply(t.text, t.search_query, t.author_username);
      return { suggested_reply: reply, suggested_image: image };
    })(),
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
