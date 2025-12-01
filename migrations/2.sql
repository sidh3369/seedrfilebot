
-- Create new table for multiple Seedr accounts
CREATE TABLE seedr_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  seedr_access_token TEXT NOT NULL,
  seedr_refresh_token TEXT,
  account_email TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_seedr_accounts_user_id ON seedr_accounts(user_id);
CREATE INDEX idx_seedr_accounts_active ON seedr_accounts(is_active);
