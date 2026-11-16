-- Operation Managers can access several projects, each with its own countries.
-- Existing rows keep their current project (temp_users.op_project_slug).
BEGIN;

ALTER TABLE temp_op_countries
  ADD COLUMN IF NOT EXISTS project_slug VARCHAR(100);

UPDATE temp_op_countries oc
   SET project_slug = COALESCE(NULLIF(TRIM(u.op_project_slug), ''), '')
  FROM temp_users u
 WHERE u.id = oc.user_id
   AND oc.project_slug IS NULL;

UPDATE temp_op_countries SET project_slug = '' WHERE project_slug IS NULL;

ALTER TABLE temp_op_countries
  ALTER COLUMN project_slug SET DEFAULT '',
  ALTER COLUMN project_slug SET NOT NULL;

-- Same country may now appear once per project (Nigeria in Africa and Africa 2).
ALTER TABLE temp_op_countries DROP CONSTRAINT IF EXISTS temp_op_countries_pkey;
ALTER TABLE temp_op_countries ADD PRIMARY KEY (user_id, project_slug, country);

COMMIT;
