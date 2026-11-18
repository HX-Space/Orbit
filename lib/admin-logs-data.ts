import { query } from "@/lib/db";
import { opScopeIncludes } from "@/lib/op-scope";
import type { OpAccessScope } from "@/types/admin";
import {
  ORBIT_LOG_ACTIONS,
  ORBIT_LOG_RESOURCES,
  type OrbitActionLogRow,
  type OrbitLogCursor,
  type OrbitLogAction,
  type OrbitLogListFilters,
  type OrbitLogResource,
} from "@/types/logs";

/** Activity page loads this many entries at a time (more on scroll). */
export const LOG_PAGE_SIZE = 50;

type LogDbRow = {
  id: number;
  created_at: Date | string;
  actor_id: number | null;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  action: string;
  resource: string;
  summary: string;
  details: unknown;
};

function isOrbitLogAction(value: string): value is OrbitLogAction {
  return (ORBIT_LOG_ACTIONS as readonly string[]).includes(value);
}

function isOrbitLogResource(value: string): value is OrbitLogResource {
  return (ORBIT_LOG_RESOURCES as readonly string[]).includes(value);
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function asDetails(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapRow(row: LogDbRow): OrbitActionLogRow {
  return {
    id: row.id,
    createdAt: asIso(row.created_at),
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorEmail: row.actor_email,
    actorRole: row.actor_role,
    action: isOrbitLogAction(row.action) ? row.action : "update",
    resource: isOrbitLogResource(row.resource) ? row.resource : "auth",
    summary: row.summary,
    details: asDetails(row.details),
  };
}

export function parseOrbitLogFilters(params: {
  q?: string;
  action?: string;
  resource?: string;
}): OrbitLogListFilters {
  const q = params.q?.trim() ?? "";
  const actionRaw = params.action?.trim() ?? "all";
  const resourceRaw = params.resource?.trim() ?? "all";
  return {
    q,
    action: isOrbitLogAction(actionRaw) ? actionRaw : "all",
    resource: isOrbitLogResource(resourceRaw) ? resourceRaw : "all",
  };
}

function detailText(details: Record<string, unknown> | null, key: string): string {
  const value = details?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/** The person an entry is about: userId / employeeId, or "Name (#12)" in holder / employee. */
function logPersonId(details: Record<string, unknown> | null): number | null {
  for (const key of ["userId", "employeeId"]) {
    const value = Number(details?.[key]);
    if (Number.isInteger(value) && value > 0) return value;
  }
  for (const key of ["holder", "employee"]) {
    const match = /\(#(\d+)\)\s*$/.exec(detailText(details, key));
    if (match) return Number(match[1]);
  }
  return null;
}

/** "Main" is how the Main project (Alphaa) is labelled in some entries. */
function logProject(label: string): string {
  return label.toLowerCase() === "main" ? "Alphaa" : label;
}

/**
 * Operation Managers only see entries inside their own projects and countries.
 * The person's project counts, not just the country: Sudan is in both Africa and
 * Main, so an Africa OP doesn't see Main's Sudan activity.
 */
export async function scopeLogsForViewer(
  rows: OrbitActionLogRow[],
  scope: OpAccessScope | null
): Promise<OrbitActionLogRow[]> {
  if (!scope) return rows;

  const ids = [
    ...new Set(
      rows
        .filter((row) => detailText(row.details, "source") !== "alphaa")
        .map((row) => logPersonId(row.details))
        .filter((id): id is number => id !== null)
    ),
  ];
  const people = new Map<number, { region: string | null; country: string | null }>();
  if (ids.length > 0) {
    const found = await query<{ id: number; region: string | null; country: string | null }>(
      `SELECT id, region, country FROM temp_users WHERE id = ANY($1::int[])`,
      [ids]
    );
    for (const person of found) people.set(person.id, person);
  }

  return rows.filter((row) => {
    const details = row.details;
    const country = detailText(details, "country");
    // Main project (ALPHAA) people: only for OPs who have the Main project.
    if (detailText(details, "source") === "alphaa") {
      return opScopeIncludes(scope, "Alphaa", country);
    }
    const id = logPersonId(details);
    const person = id !== null ? people.get(id) : undefined;
    if (person) return opScopeIncludes(scope, person.region, person.country);
    // No person (Strategy, Fit to plan…): use the project the entry names.
    const project = logProject(
      detailText(details, "project") || detailText(details, "book") || detailText(details, "region")
    );
    if (project) return opScopeIncludes(scope, project, country);
    if (!country || country === "—") return false;
    return opScopeIncludes(scope, null, country);
  });
}

/**
 * Newest first, LOG_PAGE_SIZE at a time. `before` = the last entry already shown,
 * so the next batch continues from there.
 */
export async function fetchAdminActionLogs(
  filters: OrbitLogListFilters,
  before: OrbitLogCursor | null = null
): Promise<OrbitActionLogRow[]> {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.action && filters.action !== "all") {
    values.push(filters.action);
    clauses.push(`action = $${values.length}`);
  }
  if (filters.resource && filters.resource !== "all") {
    values.push(filters.resource);
    clauses.push(`resource = $${values.length}`);
  }
  const q = filters.q?.trim() ?? "";
  if (q) {
    values.push(`%${q}%`);
    const i = values.length;
    clauses.push(
      `(summary ILIKE $${i} OR actor_name ILIKE $${i} OR actor_email ILIKE $${i})`
    );
  }

  if (before) {
    values.push(before.createdAt, before.id);
    clauses.push(
      `(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length})`
    );
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  values.push(LOG_PAGE_SIZE);

  try {
    const rows = await query<LogDbRow>(
      `SELECT id, created_at, actor_id, actor_name, actor_email, actor_role,
              action, resource, summary, details
         FROM temp_action_logs
         ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT $${values.length}`,
      values
    );
    return rows.map(mapRow);
  } catch (error) {
    console.error("fetchAdminActionLogs failed", error);
    return [];
  }
}
