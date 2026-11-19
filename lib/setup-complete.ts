import { PLATFORMS, type Platform } from "@/lib/platform-config";
import { isSetupCategory, isSetupProfileComplete } from "@/lib/setup-options";
import { accountsMeetTargets } from "@/lib/setup-facebook";
import type { TempSocialMediaAccount } from "@/types/db";

export type SetupCompleteTargets = Record<Platform, number>;

export function targetsFromCounts(row: {
  target_x_count: number;
  target_facebook_personal_count: number;
  target_facebook_umbrella_count: number;
  target_instagram_count: number;
  target_tiktok_count: number;
}): SetupCompleteTargets {
  return {
    x: row.target_x_count,
    facebook_personal: row.target_facebook_personal_count,
    facebook_umbrella: row.target_facebook_umbrella_count,
    instagram: row.target_instagram_count,
    tiktok: row.target_tiktok_count,
  };
}

export function groupAccountsByPlatform(
  accounts: TempSocialMediaAccount[]
): Record<Platform, TempSocialMediaAccount[]> {
  const grouped: Record<Platform, TempSocialMediaAccount[]> = {
    x: [],
    facebook_personal: [],
    facebook_umbrella: [],
    instagram: [],
    tiktok: [],
  };
  for (const a of accounts) grouped[a.platform]?.push(a);
  return grouped;
}

export function isEmployeeSetupComplete(input: {
  country: string | null | undefined;
  language: string | null | undefined;
  targets: SetupCompleteTargets;
  accountsByPlatform: Record<Platform, TempSocialMediaAccount[]>;
  setupNeedsReview?: boolean;
}): boolean {
  if (input.setupNeedsReview) return false;
  // Accounts must match the targets. Some targets include spare accounts and
  // some don't (spares are extras on top of the plan), so either way passes.
  const countAccounts = (withSpare: boolean): SetupCompleteTargets => {
    const count = (platform: Platform) =>
      (input.accountsByPlatform[platform] ?? []).filter(
        (account) => withSpare || !account.is_spare
      ).length;
    return {
      x: count("x"),
      facebook_personal: count("facebook_personal"),
      facebook_umbrella: count("facebook_umbrella"),
      instagram: count("instagram"),
      tiktok: count("tiktok"),
    };
  };
  const hasAllExact =
    accountsMeetTargets(countAccounts(true), input.targets) ||
    accountsMeetTargets(countAccounts(false), input.targets);
  const hasProfile = isSetupProfileComplete({
    country: input.country,
    language: input.language,
  });
  const hasCategories = PLATFORMS.every((platform) =>
    (input.accountsByPlatform[platform] ?? []).every((account) =>
      isSetupCategory(account.category ?? "")
    )
  );
  return hasAllExact && hasProfile && hasCategories;
}

export function homePathForRole(
  role: string
): "/admin" | "/qc" | "/manager" | "/dashboard" {
  if (role === "admin" || role === "hoo" || role === "op") return "/admin";
  if (role === "team_lead") return "/qc";
  if (role === "manager") return "/manager";
  return "/dashboard";
}
