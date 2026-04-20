#!/usr/bin/env node
/**
 * Post to a Discord channel via webhook.
 * Sends a rich embed with the post image and text.
 *
 * Usage:
 *   node scripts/post-discord.cjs --text "..." --image "https://..."
 *
 * Env vars required:
 *   DISCORD_WEBHOOK_URL
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DEPARTURE_PURPLE = 0x7c3aed; // matches brand primary color

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--text")  args.text  = argv[i + 1];
    if (argv[i] === "--image") args.image = argv[i + 1];
  }
  return args;
}

async function main() {
  const { text, image } = parseArgs(process.argv.slice(2));

  if (!WEBHOOK_URL) {
    console.error("DISCORD_WEBHOOK_URL is not set");
    process.exit(1);
  }
  if (!text) {
    console.error("--text is required");
    process.exit(1);
  }

  const embed = {
    description: text,
    color: DEPARTURE_PURPLE,
    footer: {
      text: "Departure: Fitness Quest  •  departure.engagequalia.com",
    },
  };

  if (image) {
    embed.image = { url: image };
  }

  const payload = { embeds: [embed] };

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Discord webhook failed (${res.status}): ${body}`);
    process.exit(1);
  }

  // Discord webhooks return 204 No Content on success (no message ID).
  // Use the webhook URL hash as a stable identifier for the row.
  const webhookId = WEBHOOK_URL.split("/").slice(-2, -1)[0] || "ok";
  console.log(`Message ID: ${webhookId}-${Date.now()}`);
}

main();
