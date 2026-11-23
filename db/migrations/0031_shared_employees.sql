-- Shared employees: one person who works in more than one project / country and
-- holds accounts in each.
--
-- * temp_users.is_shared                 the "Shared employee" toggle
-- * temp_user_extra_assignments          the extra projects / countries they work in
-- * temp_social_media_accounts.assigned_region / assigned_country
--                                        the project / country one account counts for;
--                                        NULL = the holder's own project / country
-- * temp_user_slices (view)              one row per person per place they work:
--                                        the home row plus one row per extra place.
--                                        Account counts join accounts to their slice.
--
-- Also folds in temp_users.main_country ("also a Main handler"): those people
-- become shared employees with Main as an extra place, and their accounts keep
-- counting under Main as before.
--
-- Safe to re-run. The view is dropped and recreated so it always picks up every
-- temp_users column.
-- Run via: npm run db:migrate (or run this file alone)

BEGIN;

ALTER TABLE temp_users
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS temp_user_extra_assignments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES temp_users(id) ON DELETE CASCADE,
  region TEXT NOT NULL,
  country VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, region, country)
);

CREATE INDEX IF NOT EXISTS temp_user_extra_assignments_user_idx
  ON temp_user_extra_assignments (user_id);

ALTER TABLE temp_social_media_accounts
  ADD COLUMN IF NOT EXISTS assigned_region TEXT,
  ADD COLUMN IF NOT EXISTS assigned_country VARCHAR(100);

-- Fold in main_country: Main becomes an extra place, accounts stay under Main.
UPDATE temp_users
   SET is_shared = TRUE
 WHERE NULLIF(TRIM(main_country), '') IS NOT NULL
   AND region <> 'Alphaa'
   AND is_shared = FALSE;

INSERT INTO temp_user_extra_assignments (user_id, region, country)
SELECT id, 'Alphaa', TRIM(main_country)
  FROM temp_users
 WHERE NULLIF(TRIM(main_country), '') IS NOT NULL
   AND region <> 'Alphaa'
ON CONFLICT (user_id, region, country) DO NOTHING;

UPDATE temp_social_media_accounts a
   SET assigned_region = 'Alphaa',
       assigned_country = TRIM(u.main_country)
  FROM temp_users u
 WHERE a.user_id = u.id
   AND NULLIF(TRIM(u.main_country), '') IS NOT NULL
   AND u.region <> 'Alphaa'
   AND a.assigned_region IS NULL;

-- Every temp_users column, but region / country are the slice's place.
-- The person's own project / country stay in home_region / home_country.
DROP VIEW IF EXISTS temp_user_slices;
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg('u.' || quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = current_schema()
     AND table_name = 'temp_users'
     AND column_name NOT IN ('region', 'country');

  EXECUTE format(
    'CREATE VIEW temp_user_slices AS
       SELECT %1$s,
              u.region::text AS region, u.country::text AS country,
              u.region::text AS home_region, u.country::text AS home_country,
              FALSE AS is_extra_slice
         FROM temp_users u
       UNION ALL
       SELECT %1$s,
              x.region::text, x.country::text,
              u.region::text, u.country::text,
              TRUE
         FROM temp_users u
         INNER JOIN temp_user_extra_assignments x ON x.user_id = u.id
        WHERE u.is_shared = TRUE
          -- an extra place equal to the home place would count accounts twice
          AND NOT (LOWER(TRIM(x.region)) = LOWER(TRIM(COALESCE(u.region, '''')))
                   AND LOWER(TRIM(x.country)) = LOWER(TRIM(COALESCE(u.country, ''''))))',
    cols
  );
END $$;

COMMIT;
