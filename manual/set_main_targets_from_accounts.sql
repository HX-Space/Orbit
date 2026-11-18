-- Main project (ALPHAA) employees were copied into Orbit without account
-- targets, so every one shows "Assigned 0" and "15 / 0" on the CM's page.
--
-- This sets each Main employee's five targets (X, Facebook Personal,
-- Facebook Umbrella, Instagram, TikTok) to the accounts they already have on
-- that platform. Spare accounts are not counted (they are extras on top of the
-- plan). Other platforms (YouTube, Threads, Telegram...) have no target field.
--
-- Safe to re-run: it only touches Main employees whose five targets are all 0,
-- so targets a Country Manager has already typed in are never overwritten.
--
-- Run the whole file at once. Step 1 shows what will change, step 3 checks it.

BEGIN;

-- 1) Preview: Main employees still at 0, and the targets they will get.
WITH main AS (
  SELECT id
    FROM temp_users
   WHERE role = 'employee'
     AND LOWER(TRIM(COALESCE(region, ''))) IN ('alphaa', 'main')
     AND COALESCE(target_x_count, 0)
       + COALESCE(target_facebook_personal_count, 0)
       + COALESCE(target_facebook_umbrella_count, 0)
       + COALESCE(target_instagram_count, 0)
       + COALESCE(target_tiktok_count, 0) = 0
)
SELECT COUNT(DISTINCT m.id)                                            AS employees_at_zero,
       COUNT(a.id) FILTER (WHERE a.platform = 'x')                     AS x,
       COUNT(a.id) FILTER (WHERE a.platform = 'facebook_personal')     AS facebook_personal,
       COUNT(a.id) FILTER (WHERE a.platform = 'facebook_umbrella')     AS facebook_umbrella,
       COUNT(a.id) FILTER (WHERE a.platform = 'instagram')             AS instagram,
       COUNT(a.id) FILTER (WHERE a.platform = 'tiktok')                AS tiktok
  FROM main m
  LEFT JOIN temp_social_media_accounts a
         ON a.user_id = m.id
        AND COALESCE(a.is_spare, FALSE) = FALSE;

-- 2) Set the targets from their current (non-spare) accounts.
WITH main AS (
  SELECT id
    FROM temp_users
   WHERE role = 'employee'
     AND LOWER(TRIM(COALESCE(region, ''))) IN ('alphaa', 'main')
     AND COALESCE(target_x_count, 0)
       + COALESCE(target_facebook_personal_count, 0)
       + COALESCE(target_facebook_umbrella_count, 0)
       + COALESCE(target_instagram_count, 0)
       + COALESCE(target_tiktok_count, 0) = 0
),
counts AS (
  SELECT m.id AS user_id,
         COUNT(a.id) FILTER (WHERE a.platform = 'x')                 AS x,
         COUNT(a.id) FILTER (WHERE a.platform = 'facebook_personal') AS facebook_personal,
         COUNT(a.id) FILTER (WHERE a.platform = 'facebook_umbrella') AS facebook_umbrella,
         COUNT(a.id) FILTER (WHERE a.platform = 'instagram')         AS instagram,
         COUNT(a.id) FILTER (WHERE a.platform = 'tiktok')            AS tiktok
    FROM main m
    LEFT JOIN temp_social_media_accounts a
           ON a.user_id = m.id
          AND COALESCE(a.is_spare, FALSE) = FALSE
   GROUP BY m.id
)
UPDATE temp_users u
   SET target_x_count                 = c.x,
       target_facebook_personal_count = c.facebook_personal,
       target_facebook_umbrella_count = c.facebook_umbrella,
       target_instagram_count         = c.instagram,
       target_tiktok_count            = c.tiktok
  FROM counts c
 WHERE u.id = c.user_id
   AND c.x + c.facebook_personal + c.facebook_umbrella + c.instagram + c.tiktok > 0;

-- 3) Check: Main employees still at 0 (expected: only people with no accounts
--    on those five platforms).
SELECT COUNT(*) AS main_employees_still_zero
  FROM temp_users
 WHERE role = 'employee'
   AND LOWER(TRIM(COALESCE(region, ''))) IN ('alphaa', 'main')
   AND COALESCE(target_x_count, 0)
     + COALESCE(target_facebook_personal_count, 0)
     + COALESCE(target_facebook_umbrella_count, 0)
     + COALESCE(target_instagram_count, 0)
     + COALESCE(target_tiktok_count, 0) = 0;

COMMIT;
