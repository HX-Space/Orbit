"use server";

import { getAdminViewerOrNull } from "@/lib/admin-access";
import { fetchAdminCommandPalettePeople } from "@/lib/admin-data";
import { opScopeIncludes } from "@/lib/op-scope";
import type { CommandPalettePerson } from "@/types/layout";

/** Top-bar search data, loaded when search opens (not with every page). */
export async function loadCommandPalettePeople(): Promise<CommandPalettePerson[]> {
  const viewer = await getAdminViewerOrNull();
  if (!viewer) return [];
  const people = await fetchAdminCommandPalettePeople();
  if (viewer.role !== "op" || !viewer.scope) return people;

  // Operation Managers only find people in their own projects and countries
  // (Sudan in Main is not Sudan in Africa).
  const scope = viewer.scope;
  return people.filter(
    (person) => Boolean(person.country) && opScopeIncludes(scope, person.region, person.country)
  );
}
