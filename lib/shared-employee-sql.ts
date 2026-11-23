/**
 * Shared employees work in more than one project / country.
 *
 * `temp_user_slices` (migration 0031) has one row per person per place they
 * work: the home row, plus one row per extra place for shared employees. In a
 * slice row `region` / `country` are that place; the person's own project /
 * country are `home_region` / `home_country`.
 *
 * Account counts read slices and join each account to the slice it belongs to,
 * so an account counts in exactly one project / country. Head counts use home
 * rows only: a shared employee counts as a person in their home project.
 */

/** Use in place of `temp_users` wherever accounts are counted per project / country. */
export const TEMP_USER_SLICES = "temp_user_slices";

/** The account belongs to this slice (its own project / country, else the holder's). */
export function accountInSliceSql(account = "a", slice = "u"): string {
  return `(LOWER(TRIM(COALESCE(NULLIF(TRIM(${account}.assigned_region), ''), ${slice}.home_region, '')))
             = LOWER(TRIM(COALESCE(${slice}.region, '')))
           AND LOWER(TRIM(COALESCE(NULLIF(TRIM(${account}.assigned_country), ''), ${slice}.home_country, '')))
             = LOWER(TRIM(COALESCE(${slice}.country, ''))))`;
}

/** Home rows only — for counting people. */
export function homeSliceSql(slice = "u"): string {
  return `${slice}.is_extra_slice = FALSE`;
}
