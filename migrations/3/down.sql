
DROP INDEX idx_seedr_accounts_mocha_user_id;
DROP INDEX idx_users_mocha_user_id;
ALTER TABLE seedr_accounts DROP COLUMN mocha_user_id;
ALTER TABLE users DROP COLUMN mocha_user_id;
