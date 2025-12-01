
ALTER TABLE users ADD COLUMN mocha_user_id TEXT;
ALTER TABLE seedr_accounts ADD COLUMN mocha_user_id TEXT;
CREATE INDEX idx_users_mocha_user_id ON users(mocha_user_id);
CREATE INDEX idx_seedr_accounts_mocha_user_id ON seedr_accounts(mocha_user_id);
