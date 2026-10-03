export type Statement = string | { sql: string; args?: (string | number | null)[] };
export type QueryResult = { rows: Record<string, unknown>[]; rowsAffected: number };
export type DatabaseClient = {
  execute(statement: Statement): Promise<QueryResult>;
  batch(statements: Statement[], mode: "write"): Promise<QueryResult[]>;
  close(): void;
};

export function normalizeResult(result: { columns: string[]; rows: unknown[]; rowsAffected: number }): QueryResult {
  return {
    rows: result.rows.map((row) => Array.isArray(row)
      ? Object.fromEntries(result.columns.map((column, i) => [column, row[i]]))
      : row as Record<string, unknown>),
    rowsAffected: result.rowsAffected,
  };
}
