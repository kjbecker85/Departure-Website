#!/usr/bin/env node
/**
 * Daily social media posting script.
 * Reads content-queue.json, finds today's post, posts to X and Instagram,
 * then marks it as posted.
 *
 * Usage:
 *   node scripts/post-daily.cjs              # Post today's content
 *   node scripts/post-daily.cjs --date 2026-04-20  # Post a specific date's content
 *   node scripts/post-daily.cjs --dry-run     # Preview without posting
 */

const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// Load env
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const QUEUE_PATH = path.resolve(__dirname, "../content-queue.json");
const SITE_BASE = "https://departure.engagequalia.com";

function getToday() {
  // Format as YYYY-MM-DD in local timezone
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function loadQueue() {
  const raw = fs.readFileSync(QUEUE_PATH, "utf-8");
  return JSON.parse(raw);
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + "\n");
}

function postToX(text, localImagePath) {
  const scriptArgs = ["--text", text];
  if (localImagePath && fs.existsSync(localImagePath)) {
    scriptArgs.push("--image", localImagePath);
  }
  console.log("\n--- Posting to X ---");
  try {
    const result = execFileSync("node", [path.resolve(__dirname, "post-x.cjs"), ...scriptArgs], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf-8",
      timeout: 30000,
      env: process.env,
    });
    console.log(result);
    return true;
  } catch (err) {
    console.error("X post failed:", err.stderr || err.message);
    return false;
  }
}

function postToInstagram(text, imageUrl) {
  console.log("\n--- Posting to Instagram ---");
  try {
    const result = execFileSync("node", [
      path.resolve(__dirname, "post-instagram.cjs"),
      "--text", text,
      "--image", imageUrl,
    ], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf-8",
      timeout: 120000,
      env: process.env,
    });
    console.log(result);
    return true;
  } catch (err) {
    console.error("Instagram post failed:", err.stderr || err.message);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dateIdx = args.indexOf("--date");
  const targetDate = dateIdx !== -1 ? args[dateIdx + 1] : getToday();

  console.log(`Looking for post scheduled for: ${targetDate}`);
  if (dryRun) console.log("(DRY RUN — will not actually post)\n");

  const queue = loadQueue();
  const postIdx = queue.findIndex(
    (p) => p.date === targetDate && !p.posted && !p.skip
  );

  if (postIdx === -1) {
    console.log("No unposted content found for this date.");

    // Show next upcoming post
    const upcoming = queue
      .filter((p) => !p.posted && !p.skip && p.date > targetDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (upcoming.length > 0) {
      console.log(`Next scheduled post: ${upcoming[0].date} (${upcoming[0].type})`);
    } else {
      console.log("No more posts in queue!");
    }
    return;
  }

  const post = queue[postIdx];
  const imageUrl = `${SITE_BASE}/${post.image}`;
  const localImagePath = path.resolve(__dirname, "..", "public", post.image);

  console.log(`Found post: ${post.type}`);
  console.log(`Image: ${post.image}`);
  console.log(`\nX text:\n${post.x_text}`);
  console.log(`\nIG text:\n${post.ig_text}`);
  console.log(`\nImage URL: ${imageUrl}`);

  if (dryRun) {
    console.log("\n--- DRY RUN COMPLETE ---");
    return;
  }

  let xSuccess = false;
  let igSuccess = false;

  // Post to X (uses local image)
  if (post.x_text) {
    xSuccess = postToX(post.x_text, localImagePath);
  }

  // Post to Instagram (uses public URL)
  if (post.ig_text && post.image) {
    igSuccess = postToInstagram(post.ig_text, imageUrl);
  }

  // Mark as posted if at least one platform succeeded
  if (xSuccess || igSuccess) {
    queue[postIdx].posted = true;
    queue[postIdx].posted_at = new Date().toISOString();
    queue[postIdx].x_posted = xSuccess;
    queue[postIdx].ig_posted = igSuccess;
    saveQueue(queue);
    console.log("\n--- Post marked as completed in queue ---");
  } else {
    console.error("\n--- Both platforms failed! Post NOT marked as completed ---");
    process.exit(1);
  }
}

main();
