#!/usr/bin/env node
/**
 * Preview upcoming social media posts.
 *
 * Usage:
 *   node scripts/preview-queue.cjs          # Show next 7 days
 *   node scripts/preview-queue.cjs --all    # Show all posts
 *   node scripts/preview-queue.cjs --days 14 # Show next 14 days
 */

const path = require("path");
const fs = require("fs");

const QUEUE_PATH = path.resolve(__dirname, "../content-queue.json");

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function main() {
  const args = process.argv.slice(2);
  const showAll = args.includes("--all");
  const daysIdx = args.indexOf("--days");
  const days = daysIdx !== -1 ? parseInt(args[daysIdx + 1]) : 7;

  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, "utf-8"));
  const today = getToday();
  const endDate = addDays(today, days);

  const posted = queue.filter((p) => p.posted);
  const upcoming = queue.filter((p) => !p.posted && !p.skip);
  const skipped = queue.filter((p) => p.skip);

  console.log("═══════════════════════════════════════════════");
  console.log("  DEPARTURE — Social Media Queue");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Today: ${today}`);
  console.log(`  Posted: ${posted.length} | Upcoming: ${upcoming.length} | Skipped: ${skipped.length}`);
  console.log("───────────────────────────────────────────────\n");

  const toShow = showAll
    ? upcoming
    : upcoming.filter((p) => p.date <= endDate);

  if (toShow.length === 0) {
    console.log("  No upcoming posts in range.\n");
    return;
  }

  for (const post of toShow) {
    const isToday = post.date === today;
    const marker = isToday ? " ◀ TODAY" : "";
    const typeEmoji =
      post.type === "monster" ? "🐉" : post.type === "feature" ? "⚡" : "💬";

    console.log(
      `  ${post.date} ${typeEmoji} ${post.type.toUpperCase()}${marker}`
    );
    console.log(`  Image: ${post.image}`);
    console.log(`  X: ${post.x_text.split("\n")[0].substring(0, 70)}...`);
    console.log(`  IG: ${post.ig_text.split("\n")[0].substring(0, 70)}...`);
    console.log("");
  }

  console.log("───────────────────────────────────────────────");
  console.log("  Commands:");
  console.log("  node scripts/post-daily.cjs --dry-run    Preview today's post");
  console.log("  node scripts/post-daily.cjs              Post today's content");
  console.log("  Edit content-queue.json to modify posts");
  console.log("═══════════════════════════════════════════════\n");
}

main();
