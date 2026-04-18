#!/usr/bin/env node
/**
 * Audit + optional sync of image_path between content-queue.json and
 * Supabase social_posts.
 *
 * content-queue.json is the source of truth for IMAGE assignments. Text
 * (x_text, ig_text, fb_text) is NOT synced because the DB copy has the
 * "1,000 free coins" CTA appended and is edited via the admin dashboard.
 * Only image_path drift and missing image files are checked here.
 *
 * Usage:
 *   node scripts/sync-queue.cjs           # audit only, prints diff
 *   node scripts/sync-queue.cjs --apply   # apply fixes for upcoming/failed rows
 *   node scripts/sync-queue.cjs --apply --include-posted  # also fix posted rows
 *
 * Safety: by default, posted rows are skipped (you can't unsend a post).
 * Rerun after any manual DB edit — if a mismatch shows up unexpectedly, that
 * itself is a signal that something bypassed the queue.
 */

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PUBLIC_DIR = path.resolve(__dirname, "..", "public");

function imageExists(relPath) {
  if (!relPath) return false;
  return fs.existsSync(path.join(PUBLIC_DIR, relPath));
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const includePosted = args.includes("--include-posted");

  const queuePath = path.resolve(__dirname, "../content-queue.json");
  const queue = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
  const queueByDate = new Map(queue.map((p) => [p.date, p]));

  const { data: rows, error } = await supabase
    .from("social_posts")
    .select("id, scheduled_date, status, image_path, x_text, ig_text")
    .order("scheduled_date", { ascending: true });

  if (error) {
    console.error("Failed to fetch social_posts:", error.message);
    process.exit(1);
  }

  const mismatches = [];
  const missingImages = [];
  const missingInDb = [];

  for (const p of queue) {
    if (!rows.find((r) => r.scheduled_date === p.date)) {
      missingInDb.push(p.date);
    }
  }

  for (const r of rows) {
    const q = queueByDate.get(r.scheduled_date);
    if (!q) continue;

    // Only image_path is synced. Text is intentionally different (CTA append).
    if ((r.image_path || "") !== (q.image || "")) {
      mismatches.push({
        id: r.id,
        date: r.scheduled_date,
        status: r.status,
        diffs: {
          image_path: { current: r.image_path, queue: q.image },
        },
      });
    }

    if (r.image_path && !imageExists(r.image_path)) {
      missingImages.push({ date: r.scheduled_date, path: r.image_path });
    }
  }

  // Report
  console.log(`Queue: ${queue.length} posts | DB: ${rows.length} rows`);
  console.log(`Mismatches: ${mismatches.length}`);
  console.log(`DB rows with missing image files: ${missingImages.length}`);
  console.log(`Queue dates not in DB: ${missingInDb.length}`);
  console.log();

  for (const m of mismatches) {
    console.log(`[${m.status}] ${m.date} (${m.id.slice(0, 8)})`);
    for (const [field, vals] of Object.entries(m.diffs)) {
      const cur = (vals.current || "").toString().split("\n")[0].slice(0, 70);
      const q = (vals.queue || "").toString().split("\n")[0].slice(0, 70);
      console.log(`    ${field}:`);
      console.log(`      db   : ${cur}`);
      console.log(`      queue: ${q}`);
    }
  }

  for (const mi of missingImages) {
    console.log(`MISSING FILE  ${mi.date}  ${mi.path}`);
  }
  for (const d of missingInDb) {
    console.log(`QUEUE DATE NOT IN DB  ${d}`);
  }

  if (!apply) {
    if (mismatches.length > 0 || missingImages.length > 0) {
      console.log("\nRun with --apply to fix.");
      process.exit(1);
    }
    console.log("\nAll in sync.");
    return;
  }

  // Apply fixes
  let applied = 0;
  let skipped = 0;
  for (const m of mismatches) {
    if (m.status === "posted" && !includePosted) {
      console.log(`Skipping posted row ${m.date} (use --include-posted to force)`);
      skipped++;
      continue;
    }
    const update = {};
    for (const [field, vals] of Object.entries(m.diffs)) {
      update[field] = vals.queue;
    }
    const { error: upErr } = await supabase
      .from("social_posts")
      .update(update)
      .eq("id", m.id);
    if (upErr) {
      console.error(`FAIL ${m.date}: ${upErr.message}`);
    } else {
      console.log(`FIXED ${m.date}`);
      applied++;
    }
  }

  console.log(`\nApplied ${applied} fixes, skipped ${skipped} posted rows.`);
}

main();
