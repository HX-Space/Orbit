export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireFullAdminActor } from "@/lib/admin-access";
import {
  STRATEGY_TEMPLATE_TABS,
  buildStrategyTemplateWorkbook,
} from "@/lib/strategy-template-export";

/** GET ?tabs=Main,Africa (or tabs=all) → the Alpha Strategy template filled with the plan. */
export async function GET(request: Request) {
  let scope;
  try {
    ({ scope } = await requireFullAdminActor("strategy", "canRead"));
  } catch {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("tabs")?.trim() ?? "all";
  const asked = raw.toLowerCase() === "all" ? [...STRATEGY_TEMPLATE_TABS] : raw.split(",");
  const tabs = STRATEGY_TEMPLATE_TABS.filter((tab) =>
    asked.some((item) => item.trim().toLowerCase() === tab.toLowerCase())
  );
  if (tabs.length === 0) {
    return NextResponse.json({ error: "Pick at least one project." }, { status: 400 });
  }

  try {
    // Operation Managers only get their own projects.
    const projectSlugs = scope ? scope.projects.map((project) => project.projectSlug) : undefined;
    const file = await buildStrategyTemplateWorkbook(tabs, projectSlugs);
    const name =
      tabs.length === STRATEGY_TEMPLATE_TABS.length
        ? "Alpha Strategy.xlsx"
        : `Alpha Strategy - ${tabs.join(", ")}.xlsx`;
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Could not build the strategy template.", error);
    return NextResponse.json({ error: "Could not build the strategy file." }, { status: 500 });
  }
}
