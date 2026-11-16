-- Strategy: create "Africa 2" and "Europe 2" as copies of the Africa and Europe plans.
-- Copies only the plan (countries, languages, resources, targets). No people, CMs or accounts.
-- Safe to re-run: skips anything that already exists.
BEGIN;

-- 1. The two top-level projects.
INSERT INTO strategy_projects (
  name, slug, parent_id, region, platforms, language, resources, total_accounts,
  project_targets, handler_targets
)
SELECT v.new_name, v.new_slug, NULL, p.region, p.platforms, p.language, p.resources,
       p.total_accounts, p.project_targets, p.handler_targets
  FROM strategy_projects p
  JOIN (VALUES ('africa', 'Africa 2', 'africa-2'),
               ('europe', 'Europe 2', 'europe-2')) AS v(src_slug, new_name, new_slug)
    ON p.slug = v.src_slug AND p.parent_id IS NULL
 WHERE NOT EXISTS (SELECT 1 FROM strategy_projects x WHERE x.slug = v.new_slug);

-- 2. Their countries, copied from the originals (africa-nigeria -> africa-2-nigeria).
INSERT INTO strategy_projects (
  name, slug, parent_id, region, platforms, language, resources, total_accounts,
  project_targets, handler_targets
)
SELECT c.name,
       np.slug || SUBSTRING(c.slug FROM LENGTH(sp.slug) + 1),
       np.id, c.region, c.platforms, c.language, c.resources, c.total_accounts,
       c.project_targets, c.handler_targets
  FROM strategy_projects sp
  JOIN (VALUES ('africa', 'africa-2'),
               ('europe', 'europe-2')) AS v(src_slug, new_slug)
    ON sp.slug = v.src_slug AND sp.parent_id IS NULL
  JOIN strategy_projects c  ON c.parent_id = sp.id
  JOIN strategy_projects np ON np.slug = v.new_slug AND np.parent_id IS NULL
 WHERE NOT EXISTS (
         SELECT 1 FROM strategy_projects x
          WHERE x.parent_id = np.id AND LOWER(x.name) = LOWER(c.name)
       );

-- 3. Check: expect Africa 2 = 10 countries, Europe 2 = 6, totals equal to the originals.
SELECT p.name, COUNT(c.id) AS countries, p.total_accounts, SUM(c.resources) AS resources
  FROM strategy_projects p
  LEFT JOIN strategy_projects c ON c.parent_id = p.id
 WHERE p.slug IN ('africa', 'africa-2', 'europe', 'europe-2') AND p.parent_id IS NULL
 GROUP BY p.id, p.name, p.total_accounts
 ORDER BY p.name;

COMMIT;
