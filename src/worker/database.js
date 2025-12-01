export async function getUser(env, telegramUserId) {
    const result = await env.DB.prepare('SELECT * FROM users WHERE telegram_user_id = ?').bind(telegramUserId).first();
    return result || null;
}
export async function createUser(env, telegramUserId) {
    await env.DB.prepare('INSERT INTO users (telegram_user_id) VALUES (?)').bind(telegramUserId).run();
    const user = await getUser(env, telegramUserId);
    if (!user) {
        throw new Error('Failed to create user');
    }
    return user;
}
export async function updateUserSeedrTokens(env, telegramUserId, accessToken, refreshToken) {
    await env.DB.prepare('UPDATE users SET seedr_access_token = ?, seedr_refresh_token = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ?').bind(accessToken, refreshToken, telegramUserId).run();
}
export async function updateUserDeviceCode(env, telegramUserId, deviceCode) {
    await env.DB.prepare('UPDATE users SET seedr_device_code = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ?').bind(deviceCode, telegramUserId).run();
}
// New functions for multiple Seedr accounts
export async function addSeedrAccount(env, userId, accessToken, refreshToken, accountEmail) {
    await env.DB.prepare('INSERT INTO seedr_accounts (user_id, seedr_access_token, seedr_refresh_token, account_email) VALUES (?, ?, ?, ?)').bind(userId, accessToken, refreshToken, accountEmail).run();
    const result = await env.DB.prepare('SELECT * FROM seedr_accounts WHERE user_id = ? AND seedr_access_token = ? ORDER BY id DESC LIMIT 1').bind(userId, accessToken).first();
    if (!result) {
        throw new Error('Failed to add Seedr account');
    }
    return result;
}
export async function getUserSeedrAccounts(env, userId) {
    // Support both numeric user_id and mocha_user_id
    if (typeof userId === 'string') {
        const { results } = await env.DB.prepare('SELECT * FROM seedr_accounts WHERE mocha_user_id = ? AND is_active = 1 ORDER BY created_at DESC').bind(userId).all();
        return results || [];
    }
    else {
        const { results } = await env.DB.prepare('SELECT * FROM seedr_accounts WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC').bind(userId).all();
        return results || [];
    }
}
export async function getAllActiveSeedrAccounts(env) {
    const { results } = await env.DB.prepare('SELECT * FROM seedr_accounts WHERE is_active = 1 ORDER BY created_at DESC').all();
    return results || [];
}
export async function deleteSeedrAccount(env, accountId) {
    await env.DB.prepare('UPDATE seedr_accounts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(accountId).run();
}
export async function getSeedrAccount(env, accountId) {
    const result = await env.DB.prepare('SELECT * FROM seedr_accounts WHERE id = ?').bind(accountId).first();
    return result || null;
}
