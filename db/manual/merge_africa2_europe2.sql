-- Merge the "Europe 2" project into "Europe" and "Africa 2" into "Africa".
--
-- Big countries stay apart under a "2" name in the merged project:
--   Europe 2: Moldova -> "Moldova 2", Slovakia -> "Slovakia 2"
--   Africa 2: Sudan   -> "Sudan 2"
-- Every other country joins the same country in Europe / Africa: plan numbers
-- (resources, accounts, per-platform targets) are added together.
--
-- What moves:
--   * Strategy: the second project's countries (strategy_projects) and the
--     Overview plan table (africa_europe_country_plans); then the second
--     project is deleted.
--   * People: employees, Country Managers (and their countries), Operation
--     Manager access, shared-employee extra places and account assignments.
--     Anyone on a big country becomes "Moldova 2" / "Slovakia 2" / "Sudan 2".
--
-- Runs in one transaction: if anything fails nothing changes. Prints counts
-- only. A project that is already gone is skipped, so re-running is harmless.
--
-- Run: psql "<database url>" -f db/manual/merge_africa2_europe2.sql

BEGIN;

-- Add two per-platform / per-scope target maps: {"twitter":{"personal":3}, ...}
CREATE OR REPLACE FUNCTION pg_temp.add_targets(a jsonb, b jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_object_agg(platform, scopes), '{}'::jsonb)
    FROM (
      SELECT platform, jsonb_object_agg(scope, total) AS scopes
        FROM (
          SELECT p.key AS platform, s.key AS scope, SUM((s.value)::text::numeric)::int AS total
            FROM (SELECT COALESCE(a, '{}'::jsonb) AS t UNION ALL SELECT COALESCE(b, '{}'::jsonb)) src,
                 jsonb_each(src.t) p,
                 jsonb_each(CASE WHEN jsonb_typeof(p.value) = 'object' THEN p.value ELSE '{}'::jsonb END) s
           WHERE jsonb_typeof(s.value) = 'number'
           GROUP BY p.key, s.key
        ) per_scope
       GROUP BY platform
    ) per_platform;
$$;

DO $$
DECLARE
  pair record;
  src record;
  dst record;
  child record;
  target record;
  new_name text;
  new_slug text;
  n int;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('europe 2', 'europe', 'Europe', ARRAY['Moldova', 'Slovakia']),
      ('africa 2', 'africa', 'Africa', ARRAY['Sudan'])
    ) AS v(src_name, dst_slug, dst_region, bigs)
  LOOP
    SELECT * INTO src FROM strategy_projects
     WHERE parent_id IS NULL AND LOWER(TRIM(name)) = pair.src_name
     LIMIT 1;
    SELECT * INTO dst FROM strategy_projects
     WHERE parent_id IS NULL AND slug = pair.dst_slug
     LIMIT 1;
    IF src.id IS NULL THEN
      RAISE NOTICE '% : project not found (already merged?), skipped', pair.src_name;
      CONTINUE;
    END IF;
    IF dst.id IS NULL THEN
      RAISE EXCEPTION 'Target project "%" not found', pair.dst_slug;
    END IF;

    -- 1. Strategy countries -------------------------------------------------
    FOR child IN SELECT * FROM strategy_projects WHERE parent_id = src.id ORDER BY id LOOP
      new_name := CASE WHEN TRIM(child.name) = ANY(pair.bigs) THEN TRIM(child.name) || ' 2'
                       ELSE TRIM(child.name) END;

      SELECT * INTO target FROM strategy_projects
       WHERE parent_id = dst.id AND LOWER(TRIM(name)) = LOWER(new_name)
       LIMIT 1;

      IF target.id IS NOT NULL THEN
        UPDATE strategy_projects
           SET resources = target.resources + child.resources,
               total_accounts = target.total_accounts + child.total_accounts,
               project_targets = pg_temp.add_targets(target.project_targets, child.project_targets),
               handler_targets = CASE WHEN target.handler_targets = '{}'::jsonb
                                      THEN child.handler_targets ELSE target.handler_targets END,
               platforms = ARRAY(SELECT DISTINCT unnest(target.platforms || child.platforms)),
               language = COALESCE(NULLIF(target.language, ''), child.language),
               updated_at = NOW()
         WHERE id = target.id;
        DELETE FROM strategy_projects WHERE id = child.id;
      ELSE
        new_slug := LOWER(REGEXP_REPLACE(dst.slug || '-' || new_name, '[^a-zA-Z0-9]+', '-', 'g'));
        IF EXISTS (SELECT 1 FROM strategy_projects WHERE slug = new_slug) THEN
          new_slug := new_slug || '-' || child.id;
        END IF;
        UPDATE strategy_projects
           SET parent_id = dst.id, name = new_name, slug = new_slug, updated_at = NOW()
         WHERE id = child.id;
      END IF;

      -- Overview plan table follows the merged Strategy country.
      INSERT INTO africa_europe_country_plans
        (country, region, language, resources, total_accounts, project_targets, handler_targets, updated_at)
      SELECT name, pair.dst_region, language, resources, total_accounts, project_targets, handler_targets, NOW()
        FROM strategy_projects
       WHERE parent_id = dst.id AND LOWER(TRIM(name)) = LOWER(new_name)
      ON CONFLICT (country) DO UPDATE
         SET region = EXCLUDED.region,
             language = COALESCE(NULLIF(africa_europe_country_plans.language, ''), EXCLUDED.language),
             resources = EXCLUDED.resources,
             total_accounts = EXCLUDED.total_accounts,
             project_targets = EXCLUDED.project_targets,
             handler_targets = EXCLUDED.handler_targets,
             updated_at = NOW();
    END LOOP;

    -- Project totals = sum of its countries.
    UPDATE strategy_projects p
       SET resources = (SELECT COALESCE(SUM(resources), 0) FROM strategy_projects WHERE parent_id = dst.id),
           total_accounts = (SELECT COALESCE(SUM(total_accounts), 0) FROM strategy_projects WHERE parent_id = dst.id),
           project_targets = (
             SELECT COALESCE(jsonb_object_agg(platform, scopes), '{}'::jsonb)
               FROM (
                 SELECT platform, jsonb_object_agg(scope, total) AS scopes
                   FROM (
                     SELECT pl.key AS platform, sc.key AS scope,
                            SUM((sc.value)::text::numeric)::int AS total
                       FROM strategy_projects c,
                            jsonb_each(c.project_targets) pl,
                            jsonb_each(CASE WHEN jsonb_typeof(pl.value) = 'object'
                                            THEN pl.value ELSE '{}'::jsonb END) sc
                      WHERE c.parent_id = dst.id AND jsonb_typeof(sc.value) = 'number'
                      GROUP BY pl.key, sc.key
                   ) per_scope
                  GROUP BY platform
               ) per_platform
           ),
           platforms = ARRAY(SELECT DISTINCT unnest(p.platforms || ARRAY(
             SELECT DISTINCT unnest(platforms) FROM strategy_projects WHERE parent_id = dst.id))),
           updated_at = NOW()
     WHERE p.id = dst.id;

    -- 2. People and accounts ------------------------------------------------
    -- Country Managers of the second project: their countries.
    UPDATE temp_manager_countries mc
       SET country = mc.country || ' 2'
      FROM temp_users u
     WHERE u.id = mc.user_id
       AND LOWER(TRIM(u.region)) = pair.src_name
       AND mc.country = ANY(pair.bigs)
       AND NOT EXISTS (SELECT 1 FROM temp_manager_countries d
                        WHERE d.user_id = mc.user_id AND d.country = mc.country || ' 2');
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '% : Country Manager countries renamed: %', pair.src_name, n;

    -- Employees / managers / OPs whose project is the second project.
    UPDATE temp_users
       SET country = CASE WHEN country = ANY(pair.bigs) THEN country || ' 2' ELSE country END,
           region = pair.dst_region,
           op_project_slug = CASE WHEN op_project_slug = src.slug THEN dst.slug ELSE op_project_slug END,
           updated_at = NOW()
     WHERE LOWER(TRIM(region)) = pair.src_name;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '% : people moved to %: %', pair.src_name, pair.dst_region, n;

    UPDATE temp_users SET op_project_slug = dst.slug, updated_at = NOW()
     WHERE op_project_slug = src.slug;

    -- Operation Manager access to the second project.
    INSERT INTO temp_op_countries (user_id, project_slug, country)
    SELECT oc.user_id, dst.slug,
           CASE WHEN oc.country = ANY(pair.bigs) THEN oc.country || ' 2' ELSE oc.country END
      FROM temp_op_countries oc
     WHERE oc.project_slug = src.slug
    ON CONFLICT DO NOTHING;
    DELETE FROM temp_op_countries WHERE project_slug = src.slug;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '% : Operation Manager access rows moved: %', pair.src_name, n;

    -- Shared employees' extra places in the second project.
    INSERT INTO temp_user_extra_assignments (user_id, region, country)
    SELECT x.user_id, pair.dst_region,
           CASE WHEN x.country = ANY(pair.bigs) THEN x.country || ' 2' ELSE x.country END
      FROM temp_user_extra_assignments x
     WHERE LOWER(TRIM(x.region)) = pair.src_name
    ON CONFLICT (user_id, region, country) DO NOTHING;
    DELETE FROM temp_user_extra_assignments WHERE LOWER(TRIM(region)) = pair.src_name;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '% : shared-employee places moved: %', pair.src_name, n;

    -- Accounts assigned to the second project.
    UPDATE temp_social_media_accounts
       SET assigned_region = pair.dst_region,
           assigned_country = CASE WHEN assigned_country = ANY(pair.bigs)
                                   THEN assigned_country || ' 2' ELSE assigned_country END
     WHERE LOWER(TRIM(assigned_region)) = pair.src_name;
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '% : accounts with a project assignment moved: %', pair.src_name, n;

    -- 3. Remove the second project (any countries left go with it) ----------
    DELETE FROM strategy_projects WHERE parent_id = src.id;
    DELETE FROM strategy_projects WHERE id = src.id;
    RAISE NOTICE '% : merged into % and removed', pair.src_name, pair.dst_region;
  END LOOP;
END $$;

-- Counts after the merge (no row values).
SELECT
  (SELECT COUNT(*) FROM strategy_projects WHERE parent_id IS NULL AND LOWER(TRIM(name)) IN ('africa 2', 'europe 2'))::int AS second_projects_left,
  (SELECT COUNT(*) FROM temp_users WHERE LOWER(TRIM(region)) IN ('africa 2', 'europe 2'))::int AS people_left_in_second_projects,
  (SELECT COUNT(*) FROM temp_users WHERE country IN ('Moldova 2', 'Slovakia 2', 'Sudan 2'))::int AS people_on_2_countries,
  (SELECT COUNT(*) FROM africa_europe_country_plans WHERE country IN ('Moldova 2', 'Slovakia 2', 'Sudan 2'))::int AS plan_rows_for_2_countries;

COMMIT;
