#!/usr/bin/env node
/**
 * Post to Instagram via the Facebook Graph API.
 *
 * Usage:
 *   node scripts/post-instagram.js --text "Your caption #hashtag" --image https://departure.engagequalia.com/screenshots/home-screen.png
 *
 * NOTE: Instagram API requires images to be publicly accessible URLs (not local files).
 * All our images are already hosted at departure.engagequalia.com.
 *
 * Setup:
 *   1. Create a Facebook Page (if you don't have one) and link your Instagram Business/Creator account
 *   2. Go to developers.facebook.com → create an app (Business type)
 *   3. Add "Instagram Graph API" product
 *   4. Generate a long-lived access token:
 *      a. Get a short-lived token from Graph API Explorer (permissions: instagram_basic, instagram_content_publish, pages_read_engagement)
 *      b. Exchange for long-lived token (60 days) via:
 *         GET https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={SHORT_TOKEN}
 *   5. Get your Instagram Business Account ID:
 *      GET https://graph.facebook.com/v21.0/me/accounts?access_token={TOKEN}  → get page ID
 *      GET https://graph.facebook.com/v21.0/{PAGE_ID}?fields=instagram_business_account&access_token={TOKEN}  → get IG ID
 *   6. Copy .env.example to .env and fill in IG_ACCESS_TOKEN and IG_BUSINESS_ACCOUNT_ID
 */

const path = require("path");

// Load .env from project root
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const REQUIRED_VARS = ["IG_ACCESS_TOKEN", "IG_BUSINESS_ACCOUNT_ID"];

function checkEnv() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error("Missing environment variables:", missing.join(", "));
    console.error("Copy .env.example to .env and fill in your Instagram API credentials.");
    process.exit(1);
  }
}

async function main() {
  checkEnv();

  const args = process.argv.slice(2);
  const textIdx = args.indexOf("--text");
  const imageIdx = args.indexOf("--image");

  if (textIdx === -1 || !args[textIdx + 1] || imageIdx === -1 || !args[imageIdx + 1]) {
    console.error('Usage: node scripts/post-instagram.js --text "Your caption" --image https://departure.engagequalia.com/screenshots/home-screen.png');
    console.error("\nNOTE: Image must be a publicly accessible URL (not a local file path).");
    process.exit(1);
  }

  const caption = args[textIdx + 1];
  const imageUrl = args[imageIdx + 1];
  const igId = process.env.IG_BUSINESS_ACCOUNT_ID;
  const token = process.env.IG_ACCESS_TOKEN;
  const apiBase = "https://graph.facebook.com/v21.0";

  try {
    // Step 1: Create media container
    console.log("Creating media container...");
    const containerRes = await fetch(`${apiBase}/${igId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption: caption,
        media_type: "IMAGE",
        access_token: token,
      }),
    });
    const containerData = await containerRes.json();

    if (containerData.error) {
      console.error("Failed to create container:", containerData.error.message);
      process.exit(1);
    }

    const containerId = containerData.id;
    console.log("Container created, ID:", containerId);

    // Step 2: Wait for processing (poll status)
    let status = "IN_PROGRESS";
    let attempts = 0;
    while (status === "IN_PROGRESS" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(
        `${apiBase}/${containerId}?fields=status_code&access_token=${token}`
      );
      const statusData = await statusRes.json();
      status = statusData.status_code;
      attempts++;
      if (status === "IN_PROGRESS") process.stdout.write(".");
    }
    console.log("");

    if (status !== "FINISHED") {
      console.error("Media processing failed with status:", status);
      process.exit(1);
    }

    // Step 3: Publish
    console.log("Publishing...");
    const publishRes = await fetch(`${apiBase}/${igId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: token,
      }),
    });
    const publishData = await publishRes.json();

    if (publishData.error) {
      console.error("Failed to publish:", publishData.error.message);
      process.exit(1);
    }

    console.log("Posted to Instagram!");
    console.log("Media ID:", publishData.id);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
}

main();
