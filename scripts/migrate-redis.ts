import { getTurso } from "../lib/turso";
import { importSnapshot, readRedisSnapshots } from "./import-redis";

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Missing source credentials");
  const dryRun = process.argv.includes("--dry-run");
  const db = dryRun ? null : getTurso();
  let inspected = 0;
  let inserted = 0;
  try {
    for await (const snapshot of readRedisSnapshots(url, token)) {
      inspected++;
      if (db) inserted += await importSnapshot(db, snapshot);
    }
    console.log(JSON.stringify({ dryRun, inspected, inserted }));
    console.log("Source Redis was not modified. Rate limits restart with empty counters on Turso.");
  } finally {
    db?.close();
  }
}
main().catch(() => {
  console.error("Migration failed. Check source/target credentials, schema setup, source data and connectivity. Partial imports can be rerun; existing target records are preserved. No source data was deleted.");
  process.exitCode = 1;
});
