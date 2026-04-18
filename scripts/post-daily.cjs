#!/usr/bin/env node
/**
 * Daily social media posting script.
 * Reads from Supabase social_posts table, finds today's post, posts to X and Instagram,
 * then updates the row status.
 *
 * Usage:
 *   node scripts/post-daily.cjs              # Post today's content
 *   node scripts/post-daily.cjs --date 2026-04-20  # Post a specific date's content
 *   node scripts/post-daily.cjs --dry-run     # Preview without posting
 */

const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { createClient } = require("@supabase/supabase-js");

// Load env
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const SITE_BASE = "https://departure.engagequalia.com";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getToday() {
  const now = new Date();
  return now.toISOString().split("T")[0];
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
    return { success: true, output: result };
  } catch (err) {
    console.error("X post failed:", err.stderr || err.message);
    return { success: false, error: err.stderr || err.message };
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
    return { success: true, output: result };
  } catch (err) {
    console.error("Instagram post failed:", err.stderr || err.message);
    return { success: false, error: err.stderr || err.message };
  }
}

function postToFacebook(text, imageUrl) {
  console.log("\n--- Posting to Facebook ---");
  const scriptArgs = ["--text", text];
  if (imageUrl) {
    scriptArgs.push("--image", imageUrl);
  }
  try {
    const result = execFileSync("node", [
      path.resolve(__dirname, "post-facebook.cjs"),
      ...scriptArgs,
    ], {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf-8",
      timeout: 30000,
      env: process.env,
    });
    console.log(result);
    return { success: true, output: result };
  } catch (err) {
    console.error("Facebook post failed:", err.stderr || err.message);
    return { success: false, error: err.stderr || err.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dateIdx = args.indexOf("--date");
  const targetDate = dateIdx !== -1 ? args[dateIdx + 1] : getToday();
  const platformsIdx = args.indexOf("--only-platforms");
  const onlyPlatforms = platformsIdx !== -1
    ? args[platformsIdx + 1].split(",").map((p) => p.trim().toLowerCase())
    : null; // null = post to all platforms

  console.log(`Looking for post scheduled for: ${targetDate}`);
  if (dryRun) console.log("(DRY RUN — will not actually post)\n");

  // Check if posting is paused
  const { data: schedule } = await supabase
    .from("posting_schedule")
    .select("paused, frequency, custom_days")
    .eq("id", 1)
    .single();

  if (schedule?.paused) {
    console.log("Posting is PAUSED. Exiting.");
    return;
  }

  // Check frequency
  if (schedule) {
    const dayOfWeek = new Date(targetDate + "T12:00:00").getDay();
    if (schedule.frequency === "weekdays" && (dayOfWeek === 0 || dayOfWeek === 6)) {
      console.log("Weekday-only schedule — skipping weekend.");
      return;
    }
    if (schedule.frequency === "custom" && !schedule.custom_days.includes(dayOfWeek)) {
      console.log(`Custom schedule — day ${dayOfWeek} not in posting days.`);
      return;
    }
  }

  // Fetch today's post — accept "upcoming" or "posted" (for partial retries via --only-platforms)
  const statusFilter = onlyPlatforms ? ["upcoming", "posted"] : ["upcoming"];
  const { data: post, error } = await supabase
    .from("social_posts")
    .select("*")
    .eq("scheduled_date", targetDate)
    .in("status", statusFilter)
    .order("scheduled_time", { ascending: true })
    .limit(1)
    .single();

  if (error || !post) {
    console.log("No upcoming post found for this date.");

    // Show next upcoming
    const { data: upcoming } = await supabase
      .from("social_posts")
      .select("scheduled_date, post_type")
      .eq("status", "upcoming")
      .gt("scheduled_date", targetDate)
      .order("scheduled_date", { ascending: true })
      .limit(1);

    if (upcoming?.length) {
      console.log(`Next scheduled post: ${upcoming[0].scheduled_date} (${upcoming[0].post_type})`);
    } else {
      console.log("No more posts in queue!");
    }
    return;
  }

  const imageUrl = post.image_path ? `${SITE_BASE}/${post.image_path}` : null;
  const localImagePath = post.image_path
    ? path.resolve(__dirname, "..", "public", post.image_path)
    : null;

  console.log(`Found post: ${post.post_type}`);
  console.log(`Image: ${post.image_path}`);
  console.log(`\nX text:\n${post.x_text}`);
  console.log(`\nIG text:\n${post.ig_text}`);
  console.log(`\nImage URL: ${imageUrl}`);

  if (dryRun) {
    console.log("\n--- DRY RUN COMPLETE ---");
    return;
  }

  let xResult = { success: false };
  let igResult = { success: false };
  let fbResult = { success: false };

  const shouldPost = (platform) => !onlyPlatforms || onlyPlatforms.includes(platform);
  if (onlyPlatforms) console.log(`Posting only to: ${onlyPlatforms.join(", ")}`);

  // Post to X (uses local image)
  if (shouldPost("x") && post.x_text) {
    xResult = postToX(post.x_text, localImagePath);
  }

  // Post to Instagram (uses public URL)
  if (shouldPost("ig") && post.ig_text && imageUrl) {
    igResult = postToInstagram(post.ig_text, imageUrl);
  }

  // Post to Facebook (uses public URL)
  if (shouldPost("fb") && (post.fb_text || post.ig_text)) {
    fbResult = postToFacebook(post.fb_text || post.ig_text, imageUrl);
  }

  // Parse post IDs from output
  function extractId(output, pattern) {
    if (!output) return null;
    const match = output.match(pattern);
    return match ? match[1] : null;
  }

  const xPostId = extractId(xResult.output, /ID:\s*(\d+)/);
  const igPostId = extractId(igResult.output, /Media ID:\s*(\d+)/);
  const fbPostId = extractId(fbResult.output, /Post ID:\s*(\S+)/);

  // Update Supabase
  if (xResult.success || igResult.success || fbResult.success) {
    await supabase
      .from("social_posts")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
        x_posted: xResult.success,
        ig_posted: igResult.success,
        fb_posted: fbResult.success,
        x_post_id: xPostId,
        ig_post_id: igPostId,
        fb_post_id: fbPostId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    console.log("\n--- Post marked as completed in Supabase ---");
  } else {
    const errorMsg = [
      xResult.error ? `X: ${xResult.error}` : null,
      igResult.error ? `IG: ${igResult.error}` : null,
      fbResult.error ? `FB: ${fbResult.error}` : null,
    ].filter(Boolean).join('; ');

    await supabase
      .from("social_posts")
      .update({
        status: "failed",
        error_message: errorMsg.substring(0, 500),
        retry_count: (post.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    console.error("\n--- Both platforms failed! Post marked as FAILED ---");
    process.exit(1);
  }
}

main();
