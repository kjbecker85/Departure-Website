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

function postToDiscord(text, imageUrl) {
  console.log("\n--- Posting to Discord ---");
  const scriptArgs = ["--text", text];
  if (imageUrl) {
    scriptArgs.push("--image", imageUrl);
  }
  try {
    const result = execFileSync("node", [
      path.resolve(__dirname, "post-discord.cjs"),
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
    console.error("Discord post failed:", err.stderr || err.message);
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

  // Fetch today's post — accept any status when retrying specific platforms
  const statusFilter = onlyPlatforms ? ["upcoming", "posted", "failed"] : ["upcoming"];
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

  // Preflight: verify the image file exists in the repo. If not, the URL will
  // 404 (or worse, serve an HTML page that IG/FB rejects as "not a photo").
  // Rather than post to X with a broken IG/FB post, abort early.
  if (localImagePath && !fs.existsSync(localImagePath)) {
    const msg = `Image file missing from public/: ${post.image_path}`;
    console.error(`\n--- Preflight FAIL: ${msg} ---`);
    await supabase
      .from("social_posts")
      .update({
        status: "failed",
        error_message: msg.substring(0, 500),
        retry_count: (post.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    process.exit(1);
  }

  // Preflight: sanity check that text and image are consistent. For monster
  // posts, the caption always starts with the monster name, and the image
  // file should contain that monster's slug. Mismatch = a prior drift.
  if (post.post_type === "monster" && post.image_path && post.x_text) {
    const nameMatch = post.x_text.match(/Monster reveal:\s*([^\n]+)/i) ||
                      post.x_text.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)*)/);
    const name = nameMatch ? nameMatch[1].trim() : null;
    if (name) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const imgLower = post.image_path.toLowerCase();
      if (!imgLower.includes(slug.split("-")[0]) && !imgLower.includes(slug)) {
        console.error(`\n--- Preflight WARNING: monster "${name}" vs image "${post.image_path}" ---`);
        console.error("    text/image appear mismatched. Run scripts/sync-queue.cjs to audit.");
        // warn but don't abort — may be intentional
      }
    }
  }

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
  let discordResult = { success: false };

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

  // Post to Discord (uses public URL + x_text for concise embed copy)
  if (shouldPost("discord") && process.env.DISCORD_WEBHOOK_URL && post.x_text) {
    discordResult = postToDiscord(post.x_text, imageUrl);
  }

  // Parse post IDs from output
  function extractId(output, pattern) {
    if (!output) return null;
    const match = output.match(pattern);
    return match ? match[1] : null;
  }

  const xPostId       = extractId(xResult.output,       /ID:\s*(\d+)/);
  const igPostId      = extractId(igResult.output,      /Media ID:\s*(\d+)/);
  const fbPostId      = extractId(fbResult.output,      /Post ID:\s*(\S+)/);
  const discordPostId = extractId(discordResult.output, /Message ID:\s*(\S+)/);

  // Update Supabase — only overwrite platform fields that were actually attempted,
  // so partial retries don't clobber a prior successful platform (e.g. X).
  if (xResult.success || igResult.success || fbResult.success || discordResult.success) {
    const updates = {
      status: "posted",
      posted_at: post.posted_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (shouldPost("x"))       { updates.x_posted       = xResult.success;       if (xPostId)       updates.x_post_id       = xPostId; }
    if (shouldPost("ig"))      { updates.ig_posted      = igResult.success;      if (igPostId)      updates.ig_post_id      = igPostId; }
    if (shouldPost("fb"))      { updates.fb_posted      = fbResult.success;      if (fbPostId)      updates.fb_post_id      = fbPostId; }
    if (shouldPost("discord")) { updates.discord_posted = discordResult.success; if (discordPostId) updates.discord_post_id = discordPostId; }
    await supabase
      .from("social_posts")
      .update(updates)
      .eq("id", post.id);

    console.log("\n--- Post marked as completed in Supabase ---");
  } else {
    const errorMsg = [
      xResult.error       ? `X: ${xResult.error}`           : null,
      igResult.error      ? `IG: ${igResult.error}`          : null,
      fbResult.error      ? `FB: ${fbResult.error}`          : null,
      discordResult.error ? `Discord: ${discordResult.error}` : null,
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

    console.error("\n--- All platforms failed! Post marked as FAILED ---");
    process.exit(1);
  }
}

main();
