/**
 * Strategy plan download: the client's "Alpha Strategy" Excel template, filled
 * with Orbit's plan (one row per project country) for the tabs that were asked
 * for. The template (templates/alpha-strategy-template.xlsx) keeps its styling;
 * only rows from row 2 down are written, and tabs not asked for are removed.
 */
import path from "node:path";
import ExcelJS from "exceljs";
import { fetchEmployeeCreateProjectOptions } from "@/lib/employee-create-projects-data";
import { projectRegionValue } from "@/lib/employee-create-projects";
import { sheetsTabForProject } from "@/lib/sheets-export-region";
import { fetchStrategyProjects } from "@/lib/strategy-projects-data";
import type {
  StrategyAccountScope,
  StrategyPlatformKey,
  StrategyProject,
  StrategyScopeCounts,
} from "@/types/strategy";

/** Template tabs, in template order. */
export const STRATEGY_TEMPLATE_TABS = ["Main", "Africa", "Europe", "Asia"] as const;
export type StrategyTemplateTab = (typeof STRATEGY_TEMPLATE_TABS)[number];

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "alpha-strategy-template.xlsx");

/** Rows the template pre-formats (header + a few sample rows); cleared below the table. */
const TEMPLATE_STYLED_ROWS = 10;

const THIN = { style: "thin" as const, color: { argb: "FF000000" } };
const DATA_BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/**
 * Template column (header text) for each Strategy platform and scope.
 * Twitter / Facebook "native" targets count as Umbrella, as Orbit's coverage does.
 */
const COLUMN_FOR: Record<StrategyPlatformKey, Record<StrategyAccountScope, string>> = {
  twitter: { personal: "Twitter-Personal", umbrella: "Twitter-Umbrella", native: "Twitter-Umbrella" },
  facebook: { personal: "Facebook-Personal", umbrella: "Facebook-Umbrella", native: "Facebook-Umbrella" },
  instagram: { personal: "Instagram-Personal", umbrella: "Instagram-Umbrella", native: "Instagram-Umbrella" },
  threads: { personal: "Threads-Personal", umbrella: "Threads-Umbrella", native: "Threads-Umbrella" },
  reddit: { personal: "Reddit-Personal", umbrella: "Reddit-Umbrella", native: "Reddit-Umbrella" },
  youtube: { personal: "YouTube-Personal", umbrella: "YouTube-Umbrella", native: "YouTube-Umbrella" },
  blogspot: { personal: "BlogSpot-Personal", umbrella: "BlogSpot-Umbrella", native: "BlogSpot-Umbrella" },
  tiktok: { personal: "TikTok-Personal", umbrella: "TikTok-Umbrella", native: "TikTok-Umbrella" },
  pinterest: { personal: "Pinterest-Personal", umbrella: "Pinterest-Umbrella", native: "Pinterest-Umbrella" },
  website: { personal: "Website", umbrella: "Website", native: "Website" },
  telegram: { personal: "Telegram-Native", umbrella: "Telegram-Native", native: "Telegram-Native" },
  turkkitap: { personal: "1000Kitap-Native", umbrella: "1000Kitap-Native", native: "1000Kitap-Native" },
  kizlarsoruyor: {
    personal: "KizlarSoruyor-Native",
    umbrella: "KizlarSoruyor-Native",
    native: "KizlarSoruyor-Native",
  },
  balatarin: { personal: "Balatarin-Native", umbrella: "Balatarin-Native", native: "Balatarin-Native" },
};

type TemplateRow = {
  region: string;
  country: string;
  language: string;
  resources: number;
  counts: Map<string, number>;
};

function countsByColumn(targets: StrategyScopeCounts): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [platform, scopes] of Object.entries(targets) as [
    StrategyPlatformKey,
    Partial<Record<StrategyAccountScope, number>>,
  ][]) {
    const columns = COLUMN_FOR[platform];
    if (!columns || !scopes) continue;
    for (const [scope, value] of Object.entries(scopes) as [StrategyAccountScope, number][]) {
      const n = Number(value) || 0;
      if (n <= 0) continue;
      const column = columns[scope];
      counts.set(column, (counts.get(column) ?? 0) + n);
    }
  }
  return counts;
}

/** The template tab a Strategy project belongs to (Africa 2 → Africa, etc.). */
function tabForProject(
  project: StrategyProject,
  options: Awaited<ReturnType<typeof fetchEmployeeCreateProjectOptions>>
): StrategyTemplateTab | null {
  const region = projectRegionValue(project.slug, project.name);
  if (region.toLowerCase() === "alphaa") return "Main";
  return sheetsTabForProject(region, options);
}

/**
 * Plan rows per tab: one row per country of every project in that tab.
 * `projectSlugs` limits it to those projects (Operation Managers).
 */
export async function fetchStrategyTemplateRows(
  projectSlugs?: string[]
): Promise<Record<StrategyTemplateTab, TemplateRow[]>> {
  const [projects, options] = await Promise.all([
    fetchStrategyProjects(),
    fetchEmployeeCreateProjectOptions(),
  ]);
  const byTab: Record<StrategyTemplateTab, TemplateRow[]> = {
    Main: [],
    Africa: [],
    Europe: [],
    Asia: [],
  };
  for (const project of projects) {
    if (projectSlugs && !projectSlugs.includes(project.slug)) continue;
    const tab = tabForProject(project, options);
    if (!tab) continue;
    const projectLabel = tab === "Main" ? "Main" : project.name.trim();
    const countries = [...project.subProjects].sort((a, b) => a.name.localeCompare(b.name));
    for (const country of countries) {
      byTab[tab].push({
        // Main countries carry their geographic region (e.g. Gulf); others their project.
        region:
          tab === "Main"
            ? country.region?.trim() || project.region?.trim() || projectLabel
            : projectLabel,
        country: country.name.trim(),
        language: country.language?.trim() || project.language?.trim() || "",
        resources: Number(country.resources) || 0,
        counts: countsByColumn(country.projectTargets ?? {}),
      });
    }
  }
  return byTab;
}

/** Fill the template for the given tabs and return the .xlsx file. */
export async function buildStrategyTemplateWorkbook(
  tabs: StrategyTemplateTab[],
  projectSlugs?: string[]
): Promise<Buffer> {
  const rowsByTab = await fetchStrategyTemplateRows(projectSlugs);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  for (const worksheet of [...workbook.worksheets]) {
    const tab = STRATEGY_TEMPLATE_TABS.find((name) => name === worksheet.name.trim());
    if (!tab || !tabs.includes(tab)) {
      workbook.removeWorksheet(worksheet.id);
      continue;
    }

    // Column number for each header in row 1.
    const columnOf = new Map<string, number>();
    worksheet.getRow(1).eachCell((cell, col) => {
      const text = String(cell.value ?? "").trim();
      if (text) columnOf.set(text, col);
    });
    const firstPlatformCol = columnOf.get("Twitter-Personal") ?? 5;
    const totalCol = columnOf.get("Total");
    const lastPlatformCol = totalCol ? totalCol - 1 : worksheet.columnCount;
    const lastCol = totalCol ?? lastPlatformCol;
    const countryCol = columnOf.get("Country");
    const resourcesCol = columnOf.get("# of Resources") ?? firstPlatformCol - 1;
    const headerRow = worksheet.getRow(1);
    const letter = (col: number) => headerRow.getCell(col).address.replace(/\d+$/, "");
    const rows = rowsByTab[tab];
    const totalsRowNumber = rows.length + 2;

    // The template only formats a few rows, so every row gets the same look here.
    // A new style object per cell: template cells share style objects, and editing
    // a shared one would reformat every empty row below the table too.
    const styleRow = (sheetRow: ExcelJS.Row, kind: "data" | "totals") => {
      for (let col = 1; col <= lastCol; col += 1) {
        const strong = kind === "totals" || col === countryCol || col === totalCol;
        sheetRow.getCell(col).style = {
          font: { name: "Calibri", size: 14, bold: strong },
          alignment: { horizontal: "center", vertical: "middle" },
          border: DATA_BORDER,
          fill:
            kind === "totals"
              ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFDEEAF6" } }
              : { type: "pattern", pattern: "none" },
          numFmt: "General",
        };
      }
      sheetRow.height = 18;
    };

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const sheetRow = worksheet.getRow(rowNumber);
      const set = (header: string, value: string | number) => {
        const col = columnOf.get(header);
        if (col) sheetRow.getCell(col).value = value;
      };
      set("Region", row.region);
      set("Country", row.country);
      set("Language", row.language);
      set("# of Resources", row.resources);
      let total = 0;
      for (let col = firstPlatformCol; col <= lastPlatformCol; col += 1) {
        const header = String(headerRow.getCell(col).value ?? "").trim();
        const value = row.counts.get(header) ?? 0;
        sheetRow.getCell(col).value = value;
        total += value;
      }
      if (totalCol) {
        sheetRow.getCell(totalCol).value = {
          formula: `SUM(${letter(firstPlatformCol)}${rowNumber}:${letter(lastPlatformCol)}${rowNumber})`,
          result: total,
        };
      }
      styleRow(sheetRow, "data");
      sheetRow.commit();
    });

    // Totals row: resources and every platform column, summed.
    if (rows.length > 0) {
      const totalsRow = worksheet.getRow(totalsRowNumber);
      totalsRow.getCell(countryCol ?? 2).value = "Total";
      for (let col = resourcesCol; col <= lastCol; col += 1) {
        let result = 0;
        for (let r = 2; r < totalsRowNumber; r += 1) {
          const value = worksheet.getRow(r).getCell(col).value;
          result +=
            typeof value === "number"
              ? value
              : Number((value as { result?: number } | null)?.result ?? 0) || 0;
        }
        totalsRow.getCell(col).value = {
          formula: `SUM(${letter(col)}2:${letter(col)}${totalsRowNumber - 1})`,
          result,
        };
      }
      styleRow(totalsRow, "totals");
      totalsRow.commit();
    }

    // Clear the template's leftover formatting below the table (e.g. a stray highlighted row).
    for (let r = totalsRowNumber + (rows.length > 0 ? 1 : 0); r <= TEMPLATE_STYLED_ROWS; r += 1) {
      const sheetRow = worksheet.getRow(r);
      for (let col = 1; col <= lastCol; col += 1) sheetRow.getCell(col).style = {};
    }

    // Columns wide enough to read, and the header + Region / Country stay in view.
    const widen = (col: number | undefined, values: string[], min: number) => {
      if (!col) return;
      const longest = Math.max(0, ...values.map((value) => value.length));
      worksheet.getColumn(col).width = Math.max(min, Math.min(40, longest * 1.3 + 3));
    };
    widen(columnOf.get("Region"), rows.map((row) => row.region), 10);
    widen(countryCol, rows.map((row) => row.country), 14);
    widen(columnOf.get("Language"), rows.map((row) => row.language), 14);
    if (totalCol) worksheet.getColumn(totalCol).width = 12;
    worksheet.views = [
      { state: "frozen", xSplit: countryCol ?? 2, ySplit: 1, topLeftCell: "A2", activeCell: "A2" },
    ];
  }

  // Excel recalculates the Total formulas when the file opens.
  workbook.calcProperties = { ...workbook.calcProperties, fullCalcOnLoad: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
