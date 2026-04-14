#!/usr/bin/env node
/**
 * Post to all platforms at once.
 *
 * Usage:
 *   node scripts/post-all.js --x "Tweet text" --ig "Instagram caption with #hashtags" --image ./public/monsters/goblin_scout.png --image-url https://departure.engagequalia.com/monsters/goblin_scout.png
 *
 * --x          Text for X/Twitter
 * --ig         Caption for Instagram (can include hashtags)
 * --image      Local path for X upload (X accepts local files)
 * --image-url  Public URL for Instagram (IG requires public URLs)
 *
 * If --ig-image-url is omitted, uses --image-url.
 * If --image is omitted, posts text-only to X.
 */

const { execSync } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const xText = getArg("--x");
const igText = getArg("--ig");
const localImage = getArg("--image");
const imageUrl = getArg("--image-url");

const scriptsDir = __dirname;

if (!xText && !igText) {
  console.error("Provide at least --x or --ig text");
  console.error('Usage: node scripts/post-all.js --x "Tweet" --ig "Caption" --image ./path.png --image-url https://url.png');
  process.exit(1);
}

const results = [];

// Post to X
if (xText) {
  try {
    const imageArg = localImage ? ` --image "${localImage}"` : "";
    execSync(`node "${path.join(scriptsDir, "post-x.js")}" --text "${xText.replace(/"/g, '\\"')}"${imageArg}`, {
      stdio: "inherit",
      cwd: path.resolve(scriptsDir, ".."),
    });
    results.push("X: SUCCESS");
  } catch {
    results.push("X: FAILED");
  }
}

// Post to Instagram
if (igText && imageUrl) {
  try {
    execSync(
      `node "${path.join(scriptsDir, "post-instagram.js")}" --text "${igText.replace(/"/g, '\\"')}" --image "${imageUrl}"`,
      {
        stdio: "inherit",
        cwd: path.resolve(scriptsDir, ".."),
      },
    );
    results.push("Instagram: SUCCESS");
  } catch {
    results.push("Instagram: FAILED");
  }
} else if (igText) {
  console.warn("Skipping Instagram — --image-url required (IG needs public URLs)");
  results.push("Instagram: SKIPPED (no --image-url)");
}

console.log("\n--- Results ---");
results.forEach((r) => console.log(r));
