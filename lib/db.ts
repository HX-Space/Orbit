import pkg from "pg";
const { Pool, types } = pkg;

// Keep PostgreSQL `DATE` (OID 1082) values as plain `YYYY-MM-DD` strings
// instead of JS Date objects. The default parser produces a Date in the
// server's local timezone, which then drifts a day when re-formatted in UTC
// (Cairo is UTC+3, so a stored `2026-05-11` would round-trip to `2026-05-10`).
types.setTypeParser(1082, (value: string) => value);

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 5432,
  // Each Vercel instance has its own pool; a small one keeps the total under
  // the database's connection limit ("service temporarily unavailable").
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

/**
 * "View as" is read only: while an Admin / HOD views Orbit as another person,
 * every statement that would change data is refused. Reads, transaction
 * control and the Activity log (temp_action_logs) still run.
 */
export const VIEW_AS_READ_ONLY_ERROR =
  "You are viewing as another person — read only. Exit \"View as\" to make changes.";

const ALWAYS_ALLOWED_WRITE = /^\s*insert\s+into\s+temp_action_logs\b/i;

function changesData(text: string): boolean {
  const sql = text.replace(/^(\s|--[^\n]*\n)*/, "");
  if (/^(select|show|explain|begin|commit|rollback|savepoint|release|set|values)\b/i.test(sql)) {
    return false;
  }
  // "Create if missing" checks some pages run on every load change nothing.
  if (/^create\s+(table|index)\s+if\s+not\s+exists\b/i.test(sql)) {
    return false;
  }
  if (/^with\b/i.test(sql)) return /\b(insert|update|delete|merge|truncate)\b/i.test(sql);
  return !ALWAYS_ALLOWED_WRITE.test(sql);
}

/** True while the signed-in Admin / HOD is viewing as someone. Never throws. */
async function viewingAsSomeone(): Promise<boolean> {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    return Boolean(session?.viewAs);
  } catch {
    // Outside a request (scripts, sign-in) there is nobody to view as.
    return false;
  }
}

type QueryFn = (...args: unknown[]) => unknown;

pool.on("connect", (client) => {
  const target = client as unknown as { query: QueryFn };
  const original = target.query.bind(client) as QueryFn;
  target.query = (...args: unknown[]) => {
    const first = args[0] as string | { text?: string } | undefined;
    const text = typeof first === "string" ? first : first?.text;
    if (!text || !changesData(text)) return original(...args);

    const last = args[args.length - 1];
    const callback = typeof last === "function" ? (last as (error: Error) => void) : null;
    const check = viewingAsSomeone().then((viewing) => {
      if (viewing) throw new Error(VIEW_AS_READ_ONLY_ERROR);
    });
    if (callback) {
      check.then(() => original(...args), (error: Error) => callback(error));
      return undefined;
    }
    return check.then(() => original(...args));
  };
});

// Typed query helper — use this for all parameterized queries.
// Example: const rows = await query<TempUser>('SELECT * FROM temp_users WHERE id = $1', [id]);
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
