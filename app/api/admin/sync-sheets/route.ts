export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireFullAdminActor } from "@/lib/admin-access";
import { fetchAlphaaAccountsForSheetsExport } from "@/lib/alphaa-sheets-export-data";
import { fetchAccountsForSheetsExport } from "@/lib/admin-sheets-export-data";
import { syncAccountsToGoogleSheets } from "@/lib/google-sheets";
import { logOrbitAction } from "@/lib/orbit-log";
import type { SheetsSyncResult } from "@/types/admin";

export async function POST() {
  try {
    await requireFullAdminActor("overview", "canUpdate");
  } catch {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [projectAccounts, alphaaAccounts] = await Promise.all([
      fetchAccountsForSheetsExport(),
      fetchAlphaaAccountsForSheetsExport(),
    ]);
    const {
      africaCount,
      europeCount,
      balkanCount,
      asiaCount,
      africa2Count,
      europe2Count,
      alphaaCount,
      total,
    } = await syncAccountsToGoogleSheets(projectAccounts, alphaaAccounts);
    // Accounts whose project has no tab.
    const skippedCount = projectAccounts.skipped;

    const result: SheetsSyncResult = {
      success: true,
      message: "Data successfully saved to Google Sheets",
      count: total,
      africaCount,
      europeCount,
      balkanCount,
      asiaCount,
      africa2Count,
      europe2Count,
      alphaaCount,
      skippedCount,
    };

    await logOrbitAction({
      action: "sync",
      resource: "sheets",
      summary: `Synced ${total} accounts to Google Sheets`,
      details: {
        africaCount,
        europeCount,
        balkanCount,
        asiaCount,
        africa2Count,
        europe2Count,
        alphaaCount,
        skippedCount,
        total,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error saving to Google Sheets:", error);
    const message =
      error instanceof Error ? error.message : "Error saving data to Google Sheets";

    return NextResponse.json(
      {
        success: false,
        message,
      } satisfies SheetsSyncResult,
      { status: 500 }
    );
  }
}
