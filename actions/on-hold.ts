"use server";

import { requireFullAdminActor } from "@/lib/admin-access";
import { fetchOnHoldEmployees } from "@/lib/on-hold-data";
import { opScopeIncludes } from "@/lib/op-scope";
import type { OnHoldEmployee } from "@/types/admin";

/** Overview "On Hold" card: who is on hold in this tab and who they work with. */
export async function getOnHoldEmployees(region: string): Promise<OnHoldEmployee[]> {
  const { scope } = await requireFullAdminActor("overview", "canRead");
  const people = await fetchOnHoldEmployees(region);
  // Operation Managers: only their own projects and countries.
  if (!scope) return people;
  return people.filter((person) => opScopeIncludes(scope, person.region, person.country));
}
