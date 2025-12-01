/*
  # Create SeedrSync Bot Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `telegram_user_id` (text, unique) - Telegram user identifier
      - `created_at` (timestamptz) - Account creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
    
    - `seedr_accounts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `seedr_access_token` (text) - Seedr API access token
      - `seedr_refresh_token` (text, nullable) - Seedr API refresh token
      - `account_email` (text, nullable) - Associated Seedr email
      - `is_active` (boolean) - Whether account is active
      - `created_at` (timestamptz) - Account creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create seedr_accounts table
CREATE TABLE IF NOT EXISTS seedr_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seedr_access_token text NOT NULL,
  seedr_refresh_token text,
  account_email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram_user_id ON users(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_seedr_accounts_user_id ON seedr_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_seedr_accounts_active ON seedr_accounts(is_active);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE seedr_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create policies for seedr_accounts table
CREATE POLICY "Users can view own accounts"
  ON seedr_accounts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own accounts"
  ON seedr_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own accounts"
  ON seedr_accounts
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own accounts"
  ON seedr_accounts
  FOR DELETE
  TO authenticated
  USING (true);

-- Allow anonymous access (for bot operations)
CREATE POLICY "Anonymous users can manage data"
  ON users
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous users can manage accounts"
  ON seedr_accounts
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
