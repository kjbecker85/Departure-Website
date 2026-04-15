#!/usr/bin/env node
/**
 * Post to Facebook Page via the Graph API.
 *
 * Usage:
 *   node scripts/post-facebook.cjs --text "Your post" --image https://departure.engagequalia.com/social/image.jpg
 *   node scripts/post-facebook.cjs --text "Text only post"
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const REQUIRED_VARS = ["FB_PAGE_ID", "FB_PAGE_ACCESS_TOKEN"];

function checkEnv() {
  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error("Missing environment variables:", missing.join(", "));
    process.exit(1);
  }
}

async function main() {
  checkEnv();

  const args = process.argv.slice(2);
  const textIdx = args.indexOf("--text");
  const imageIdx = args.indexOf("--image");

  if (textIdx === -1 || !args[textIdx + 1]) {
    console.error('Usage: node scripts/post-facebook.cjs --text "Your post" [--image https://url.jpg]');
    process.exit(1);
  }

  const message = args[textIdx + 1];
  const imageUrl = imageIdx !== -1 ? args[imageIdx + 1] : null;
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const apiBase = "https://graph.facebook.com/v21.0";

  try {
    let endpoint;
    let body;

    if (imageUrl) {
      // Photo post
      endpoint = `${apiBase}/${pageId}/photos`;
      body = {
        url: imageUrl,
        message: message,
        access_token: token,
      };
    } else {
      // Text-only post
      endpoint = `${apiBase}/${pageId}/feed`;
      body = {
        message: message,
        access_token: token,
      };
    }

    console.log(imageUrl ? "Posting photo to Facebook Page..." : "Posting to Facebook Page...");

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.error) {
      console.error("Failed to post:", data.error.message);
      process.exit(1);
    }

    console.log("Posted to Facebook!");
    console.log("Post ID:", data.id || data.post_id);
  } catch (err) {
    console.error("Failed:", err.message);
    process.exit(1);
  }
}

main();
