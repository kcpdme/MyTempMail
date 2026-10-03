import { getTurso, initializeDatabase } from "../lib/turso";

async function main() {
  const db = getTurso();
  try {
    await initializeDatabase(db);
    console.log("Turso schema is ready.");
  } finally {
    db.close();
  }
}
main().catch(() => {
  console.error("Database setup failed. Check TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, and connectivity.");
  process.exitCode = 1;
});
