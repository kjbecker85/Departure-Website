#!/usr/bin/env node
/**
 * Post to X/Twitter with an image.
 *
 * Usage:
 *   node scripts/post-x.js --text "Your tweet text" --image ./public/monsters/goblin_scout.png
 *   node scripts/post-x.js --text "Your tweet text"  (text only)
 *
 * Setup:
 *   1. Go to developer.x.com → sign up for free tier
 *   2. Create a Project + App
 *   3. Under "User authentication settings", enable OAuth 1.0a with Read+Write
 *   4. Generate API Key, API Secret, Access Token, Access Token Secret
 *   5. Copy .env.example to .env and fill in the 4 values
 */

const { TwitterApi } = require("twitter-api-v2");
const fs = require("fs");
const path = require("path");

// Load .env from project root
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const REQUIRED_VARS = [
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_TOKEN_SECRET",
];

function checkEnv() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error("Missing environment variables:", missing.join(", "));
    console.error("Copy .env.example to .env and fill in your X API credentials.");
    process.exit(1);
  }
}

async function main() {
  checkEnv();

  const args = process.argv.slice(2);
  const textIdx = args.indexOf("--text");
  const imageIdx = args.indexOf("--image");

  if (textIdx === -1 || !args[textIdx + 1]) {
    console.error("Usage: node scripts/post-x.js --text \"Your tweet\" [--image ./path/to/image.png]");
    process.exit(1);
  }

  const text = args[textIdx + 1];
  const imagePath = imageIdx !== -1 ? args[imageIdx + 1] : null;

  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  try {
    let mediaId;
    if (imagePath) {
      const absPath = path.resolve(imagePath);
      if (!fs.existsSync(absPath)) {
        console.error("Image not found:", absPath);
        process.exit(1);
      }
      console.log("Uploading image:", absPath);
      mediaId = await client.v1.uploadMedia(absPath);
      console.log("Media uploaded, ID:", mediaId);
    }

    const tweetParams = { text };
    if (mediaId) {
      tweetParams.media = { media_ids: [mediaId] };
    }

    const result = await client.v2.tweet(tweetParams);
    console.log("Tweet posted!");
    console.log("ID:", result.data.id);
    console.log("URL: https://x.com/departurefitness/status/" + result.data.id);
  } catch (err) {
    console.error("Failed to post:", err.message);
    if (err.data) console.error("Details:", JSON.stringify(err.data, null, 2));
    process.exit(1);
  }
}

main();
