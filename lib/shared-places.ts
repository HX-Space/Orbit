import { regionDisplayLabel } from "@/lib/project-labels";
import type { SharedPlace } from "@/types/admin";

/** Stable key for a project + country (case and spaces ignored). */
export function sharedPlaceKey(place: SharedPlace): string {
  return `${place.region.trim().toLowerCase()}|${place.country.trim().toLowerCase()}`;
}

/** "Africa · Ghana (home)". */
export function sharedPlaceLabel(place: SharedPlace, isHome: boolean): string {
  const project = regionDisplayLabel(place.region) || place.region || "No project";
  const text = place.country ? `${project} · ${place.country}` : project;
  return isHome ? `${text} (home)` : text;
}
