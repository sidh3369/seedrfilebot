import { Env } from './env';

export interface User {
  id: number;
  telegram_user_id: string;
  seedr_device_code: string | null;
  seedr_access_token: string | null;
  seedr_refresh_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeedrAccount {
  id: number;
  user_id: number;
  seedr_access_token: string;
  seedr_refresh_token: string | null;
  account_email: string | null;
  is_active: boolean;
  mocha_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUser(env: Env, telegramUserId: string): Promise<User | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM users WHERE telegram_user_id = ?'
  ).bind(telegramUserId).first<User>();
  
  return result || null;
}

export async function createUser(env: Env, telegramUserId: string): Promise<User> {
  await env.DB.prepare(
    'INSERT INTO users (telegram_user_id) VALUES (?)'
  ).bind(telegramUserId).run();
  
  const user = await getUser(env, telegramUserId);
  if (!user) {
    throw new Error('Failed to create user');
  }
  return user;
}

export async function updateUserSeedrTokens(
  env: Env,
  telegramUserId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await env.DB.prepare(
    'UPDATE users SET seedr_access_token = ?, seedr_refresh_token = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ?'
  ).bind(accessToken, refreshToken, telegramUserId).run();
}

export async function updateUserDeviceCode(
  env: Env,
  telegramUserId: string,
  deviceCode: string
): Promise<void> {
  await env.DB.prepare(
    'UPDATE users SET seedr_device_code = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ?'
  ).bind(deviceCode, telegramUserId).run();
}

// New functions for multiple Seedr accounts
export async function addSeedrAccount(
  env: Env,
  userId: number,
  accessToken: string,
  refreshToken: string | null,
  accountEmail: string | null
): Promise<SeedrAccount> {
  await env.DB.prepare(
    'INSERT INTO seedr_accounts (user_id, seedr_access_token, seedr_refresh_token, account_email) VALUES (?, ?, ?, ?)'
  ).bind(userId, accessToken, refreshToken, accountEmail).run();
  
  const result = await env.DB.prepare(
    'SELECT * FROM seedr_accounts WHERE user_id = ? AND seedr_access_token = ? ORDER BY id DESC LIMIT 1'
  ).bind(userId, accessToken).first<SeedrAccount>();
  
  if (!result) {
    throw new Error('Failed to add Seedr account');
  }
  return result;
}

export async function getUserSeedrAccounts(env: Env, userId: number | string): Promise<SeedrAccount[]> {
  // Support both numeric user_id and mocha_user_id
  if (typeof userId === 'string') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM seedr_accounts WHERE mocha_user_id = ? AND is_active = 1 ORDER BY created_at DESC'
    ).bind(userId).all<SeedrAccount>();
    return results || [];
  } else {
    const { results } = await env.DB.prepare(
      'SELECT * FROM seedr_accounts WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC'
    ).bind(userId).all<SeedrAccount>();
    return results || [];
  }
}

export async function getAllActiveSeedrAccounts(env: Env): Promise<SeedrAccount[]> {
  const { results } = await env.DB.prepare(
    'SELECT * FROM seedr_accounts WHERE is_active = 1 ORDER BY created_at DESC'
  ).all<SeedrAccount>();
  
  return results || [];
}

export async function deleteSeedrAccount(env: Env, accountId: number): Promise<void> {
  await env.DB.prepare(
    'UPDATE seedr_accounts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(accountId).run();
}

export async function getSeedrAccount(env: Env, accountId: number): Promise<SeedrAccount | null> {
  const result = await env.DB.prepare(
    'SELECT * FROM seedr_accounts WHERE id = ?'
  ).bind(accountId).first<SeedrAccount>();
  
  return result || null;
}
