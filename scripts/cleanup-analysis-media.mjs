#!/usr/bin/env node
// Cleanup orphaned/soft-deleted files in the `analysis-media` storage bucket.
//
// Usage:
//   node --env-file=.env.local scripts/cleanup-analysis-media.mjs           # dry run
//   node --env-file=.env.local scripts/cleanup-analysis-media.mjs --confirm # actually delete
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (NOT the anon key).

import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
  );
  process.exit(1);
}

const confirm = process.argv.includes("--confirm");
const BUCKET = "analysis-media";
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// List every file in the bucket (recursive, paginated).
async function listAllFiles(prefix = "") {
  const out = [];
  const stack = [prefix];
  while (stack.length) {
    const p = stack.pop();
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .list(p, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const full = p ? `${p}/${entry.name}` : entry.name;
        if (entry.id === null) {
          stack.push(full); // folder
        } else {
          out.push({ name: full, size: entry.metadata?.size ?? 0 });
        }
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  return out;
}

async function fetchAll(table, columns) {
  const rows = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

console.log(`Scanning bucket "${BUCKET}"…`);
const files = await listAllFiles();
console.log(`  ${files.length} files, ${fmt(files.reduce((a, f) => a + f.size, 0))} total`);

console.log("Fetching DB references…");
const [sources, clips, sessions] = await Promise.all([
  fetchAll("analysis_source_files", "id, storage_path, deleted_at, session_id"),
  fetchAll("analysis_clips", "id, storage_path, deleted_at, session_id"),
  fetchAll("analysis_sessions", "id, deleted_at"),
]);
const sessionDeleted = new Map(sessions.map((s) => [s.id, !!s.deleted_at]));

// Map storage_path -> { kind, rowId, isDeleted }
const refs = new Map();
for (const r of sources) {
  if (!r.storage_path) continue;
  refs.set(r.storage_path, {
    kind: "source",
    id: r.id,
    deleted: !!r.deleted_at || !!sessionDeleted.get(r.session_id),
  });
}
for (const r of clips) {
  if (!r.storage_path) continue;
  refs.set(r.storage_path, {
    kind: "clip",
    id: r.id,
    deleted: !!r.deleted_at || !!sessionDeleted.get(r.session_id),
  });
}

// Classify each storage object.
const toDelete = []; // { path, size, reason, ref? }
const toKeep = [];
for (const f of files) {
  const ref = refs.get(f.name);
  if (!ref) {
    toDelete.push({ path: f.name, size: f.size, reason: "orphan_no_db_row" });
  } else if (ref.deleted) {
    toDelete.push({
      path: f.name,
      size: f.size,
      reason: ref.kind === "source" ? "soft_deleted_source" : "soft_deleted_clip",
      ref,
    });
  } else {
    toKeep.push({ path: f.name, size: f.size });
  }
}

const sumBy = (arr) => arr.reduce((a, x) => a + x.size, 0);
const groupCount = (arr) =>
  arr.reduce((m, x) => ((m[x.reason] = (m[x.reason] ?? 0) + 1), m), {});
const groupSize = (arr) =>
  arr.reduce((m, x) => ((m[x.reason] = (m[x.reason] ?? 0) + x.size), m), {});

console.log("\n=== Plan ===");
console.log(`Keep:     ${toKeep.length} files, ${fmt(sumBy(toKeep))}`);
console.log(`Delete:   ${toDelete.length} files, ${fmt(sumBy(toDelete))}`);
const counts = groupCount(toDelete);
const sizes = groupSize(toDelete);
for (const k of Object.keys(counts)) {
  console.log(`  - ${k}: ${counts[k]} files, ${fmt(sizes[k])}`);
}

if (!confirm) {
  console.log("\nDry run. Re-run with --confirm to actually delete.");
  if (toDelete.length) {
    console.log("\nFirst 10 paths that would be deleted:");
    for (const x of toDelete.slice(0, 10)) {
      console.log(`  [${x.reason}] ${fmt(x.size).padStart(8)}  ${x.path}`);
    }
  }
  process.exit(0);
}

if (toDelete.length === 0) {
  console.log("Nothing to delete.");
  process.exit(0);
}

console.log("\nDeleting storage objects in batches of 100…");
const paths = toDelete.map((x) => x.path);
let removed = 0;
for (let i = 0; i < paths.length; i += 100) {
  const batch = paths.slice(i, i + 100);
  const { error } = await supabase.storage.from(BUCKET).remove(batch);
  if (error) {
    console.error("Storage delete failed:", error);
    process.exit(1);
  }
  removed += batch.length;
  console.log(`  ${removed}/${paths.length}`);
}

console.log("\nHard-deleting matching DB rows…");
const sourceIds = toDelete.filter((x) => x.ref?.kind === "source").map((x) => x.ref.id);
const clipIds = toDelete.filter((x) => x.ref?.kind === "clip").map((x) => x.ref.id);
if (sourceIds.length) {
  const { error } = await supabase.from("analysis_source_files").delete().in("id", sourceIds);
  if (error) {
    console.error("source row delete failed:", error);
    process.exit(1);
  }
  console.log(`  analysis_source_files: ${sourceIds.length} rows`);
}
if (clipIds.length) {
  const { error } = await supabase.from("analysis_clips").delete().in("id", clipIds);
  if (error) {
    console.error("clip row delete failed:", error);
    process.exit(1);
  }
  console.log(`  analysis_clips: ${clipIds.length} rows`);
}

console.log("\nDone.");
