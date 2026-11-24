"use server";

import { requireFullAdminActor } from "@/lib/admin-access";
import { fetchAdminCountryCoverage } from "@/lib/admin-country-coverage";
import { opScopeIncludes } from "@/lib/op-scope";
import { extraAccountHolders } from "@/lib/overview-sheet-count";
import type { ExtraAccountHolder } from "@/types/admin";

/** Navbar "Extra": people holding more accounts than their planned slot. */
export async function getExtraAccountHolders(): Promise<ExtraAccountHolder[]> {
  const { scope } = await requireFullAdminActor("overview", "canRead");
  const coverage = await fetchAdminCountryCoverage({ region: "Overview" });
  const holders = await extraAccountHolders(coverage.rows);
  // Operation Managers: only their own projects and countries.
  if (!scope) return holders;
  return holders.filter((holder) =>
    opScopeIncludes(scope, holder.region, holder.country)
  );
}
