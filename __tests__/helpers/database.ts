import { connect } from "@tursodatabase/database";
import { normalizeResult, type DatabaseClient } from "@/lib/database";

export async function createTestDatabase(): Promise<DatabaseClient> {
  const db = await connect(":memory:");
  return {
    execute: async (statement) => normalizeResult((await db.batch([statement]))[0]),
    batch: async (statements, mode) => (await db.batch(statements, mode)).map(normalizeResult),
    close: () => db.close(),
  };
}
