-- Operation Managers may edit employees (profile, country, CM / TL) and add or
-- edit their accounts, inside their own projects and countries. Creating and
-- deleting employees stays with the Head of Department and Admin.
-- People with their own custom permissions (temp_user_permissions) keep them.
-- Run via: npm run db:migrate

BEGIN;

INSERT INTO admin_role_permission_defaults
  (role, page_key, can_create, can_read, can_update, can_delete)
VALUES
  ('op', 'employees', FALSE, TRUE, TRUE, FALSE)
ON CONFLICT (role, page_key) DO UPDATE
  SET can_create = FALSE,
      can_read = TRUE,
      can_update = TRUE,
      can_delete = FALSE;

COMMIT;
