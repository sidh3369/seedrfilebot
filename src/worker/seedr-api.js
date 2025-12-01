import { Hono } from "hono";
import { getDeviceCode, getTokenFromDeviceCode, loginWithPassword, addMagnet, getFolderContents, getFiles, getFileUrl, deleteFolder } from "./seedr";
import { getUserSeedrAccounts, addSeedrAccount, deleteSeedrAccount, getSeedrAccount } from "./database";
import { uploadM3U8ToGitHub } from "./github";
const seedrRouter = new Hono();
// Simple session middleware
const sessionMiddleware = async (c, next) => {
    const sessionId = c.req.header('X-Session-ID');
    if (!sessionId) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    c.set('sessionId', sessionId);
    await next();
};
// Get device code for Seedr OAuth
seedrRouter.get("/device-code", async (c) => {
    try {
        const deviceCodeData = await getDeviceCode();
        return c.json({
            success: true,
            device_code: deviceCodeData.device_code,
            user_code: deviceCodeData.user_code,
            verification_url: deviceCodeData.verification_url,
            expires_in: deviceCodeData.expires_in,
            interval: deviceCodeData.interval,
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Check device code authorization
seedrRouter.post("/check-auth", async (c) => {
    try {
        const { device_code } = await c.req.json();
        const tokens = await getTokenFromDeviceCode(device_code);
        // Generate a simple session ID
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Store session in database (use telegram_user_id as session storage)
        let user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            await c.env.DB.prepare('INSERT INTO users (telegram_user_id) VALUES (?)').bind(sessionId).run();
            user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        }
        if (user) {
            await addSeedrAccount(c.env, user.id, tokens.access_token, tokens.refresh_token || null, null);
        }
        return c.json({ success: true, sessionId });
    }
    catch (error) {
        if (error.message === 'PENDING') {
            return c.json({ success: false, pending: true });
        }
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Login with email/password
seedrRouter.post("/login", async (c) => {
    try {
        const { email, password } = await c.req.json();
        const tokens = await loginWithPassword(email, password);
        // Generate session ID
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Create or get user with session ID
        let user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            await c.env.DB.prepare('INSERT INTO users (telegram_user_id) VALUES (?)').bind(sessionId).run();
            user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        }
        if (user) {
            await addSeedrAccount(c.env, user.id, tokens.access_token, tokens.refresh_token || null, email);
        }
        return c.json({ success: true, sessionId });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Get user's Seedr accounts
seedrRouter.get("/accounts", sessionMiddleware, async (c) => {
    try {
        const sessionId = c.get('sessionId');
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }
        const { results } = await c.env.DB.prepare('SELECT * FROM seedr_accounts WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC').bind(user.id).all();
        return c.json({
            success: true,
            accounts: results || []
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Remove Seedr account
seedrRouter.delete("/accounts/:id", sessionMiddleware, async (c) => {
    try {
        const accountId = parseInt(c.req.param("id"));
        const sessionId = c.get('sessionId');
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }
        const account = await getSeedrAccount(c.env, accountId);
        if (!account || account.user_id !== user.id) {
            return c.json({ success: false, error: 'Account not found or unauthorized' }, 403);
        }
        await deleteSeedrAccount(c.env, accountId);
        return c.json({ success: true });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Add magnet link
seedrRouter.post("/magnet", sessionMiddleware, async (c) => {
    try {
        const { magnetLink } = await c.req.json();
        const sessionId = c.get('sessionId');
        if (!magnetLink || !magnetLink.startsWith('magnet:?')) {
            return c.json({ success: false, error: 'Invalid magnet link' }, 400);
        }
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }
        const accounts = await getUserSeedrAccounts(c.env, user.id);
        if (accounts.length === 0) {
            return c.json({ success: false, error: 'No Seedr accounts connected' }, 400);
        }
        const account = accounts[0];
        const folderId = await addMagnet(account.seedr_access_token, magnetLink);
        await new Promise(resolve => setTimeout(resolve, 2000));
        const folders = await getFolderContents(account.seedr_access_token);
        const folder = folders.find(f => f.id === folderId);
        return c.json({
            success: true,
            folder: folder ? {
                id: folder.id,
                name: folder.name,
                size: folder.size
            } : null
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Get all files
seedrRouter.get("/files", sessionMiddleware, async (c) => {
    try {
        const sessionId = c.get('sessionId');
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }
        const accounts = await getUserSeedrAccounts(c.env, user.id);
        if (accounts.length === 0) {
            return c.json({ success: true, files: [] });
        }
        const allFiles = [];
        for (const account of accounts) {
            try {
                const folders = await getFolderContents(account.seedr_access_token);
                allFiles.push(...folders.map(f => ({
                    id: f.id,
                    name: f.name,
                    type: f.type,
                    size: f.size,
                    accountId: account.id,
                    accountEmail: account.account_email
                })));
            }
            catch (error) {
                console.error(`Failed to get files for account ${account.id}:`, error);
            }
        }
        return c.json({ success: true, files: allFiles });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Get file links
seedrRouter.get("/files/:folderId/links", sessionMiddleware, async (c) => {
    try {
        const folderId = parseInt(c.req.param("folderId"));
        const { accountId } = c.req.query();
        const sessionId = c.get('sessionId');
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }
        const account = await getSeedrAccount(c.env, parseInt(accountId));
        if (!account || account.user_id !== user.id) {
            return c.json({ success: false, error: 'Unauthorized' }, 403);
        }
        const files = await getFiles(account.seedr_access_token, folderId);
        const links = [];
        for (const file of files.slice(0, 10)) {
            const url = await getFileUrl(account.seedr_access_token, file.folder_file_id);
            if (url) {
                links.push({ name: file.name, url });
            }
        }
        return c.json({ success: true, links });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Delete file/folder
seedrRouter.delete("/files/:folderId", sessionMiddleware, async (c) => {
    try {
        const folderId = parseInt(c.req.param("folderId"));
        const { accountId } = c.req.query();
        const sessionId = c.get('sessionId');
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }
        const account = await getSeedrAccount(c.env, parseInt(accountId));
        if (!account || account.user_id !== user.id) {
            return c.json({ success: false, error: 'Unauthorized' }, 403);
        }
        await deleteFolder(account.seedr_access_token, folderId);
        return c.json({ success: true });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Generate M3U playlist for specific folder
seedrRouter.post("/files/:folderId/m3u", sessionMiddleware, async (c) => {
    try {
        const folderId = parseInt(c.req.param("folderId"));
        const { accountId } = await c.req.json();
        const sessionId = c.get('sessionId');
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }
        const account = await getSeedrAccount(c.env, accountId);
        if (!account || account.user_id !== user.id) {
            return c.json({ success: false, error: 'Unauthorized' }, 403);
        }
        const files = await getFiles(account.seedr_access_token, folderId);
        const videoFiles = files.filter(f => f.play_video && (f.name.endsWith('.mp4') ||
            f.name.endsWith('.mkv') ||
            f.name.endsWith('.avi') ||
            f.name.endsWith('.mov')));
        if (videoFiles.length === 0) {
            return c.json({ success: false, error: 'No video files found' }, 400);
        }
        let m3u8Content = '#EXTM3U\n';
        for (const file of videoFiles) {
            const fileUrl = await getFileUrl(account.seedr_access_token, file.folder_file_id);
            if (fileUrl) {
                m3u8Content += `#EXTINF:-1,${file.name}\n`;
                m3u8Content += `${fileUrl}\n`;
            }
        }
        const githubUrl = await uploadM3U8ToGitHub(c.env, m3u8Content, `${sessionId}-${folderId}.m3u8`);
        return c.json({
            success: true,
            url: githubUrl,
            videoCount: videoFiles.length
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// Generate personal M3U playlist from all user's accounts
seedrRouter.post("/m3u/generate", sessionMiddleware, async (c) => {
    try {
        const sessionId = c.get('sessionId');
        const user = await c.env.DB.prepare('SELECT id FROM users WHERE telegram_user_id = ?').bind(sessionId).first();
        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }
        const accounts = await getUserSeedrAccounts(c.env, user.id);
        if (accounts.length === 0) {
            return c.json({ success: false, error: 'No Seedr accounts connected' }, 400);
        }
        let m3u8Content = '#EXTM3U\n';
        let totalVideos = 0;
        for (const account of accounts) {
            try {
                const folders = await getFolderContents(account.seedr_access_token);
                for (const folder of folders) {
                    try {
                        const files = await getFiles(account.seedr_access_token, folder.id);
                        const videoFiles = files.filter(f => f.play_video && (f.name.endsWith('.mp4') ||
                            f.name.endsWith('.mkv') ||
                            f.name.endsWith('.avi') ||
                            f.name.endsWith('.mov')));
                        for (const file of videoFiles) {
                            const fileUrl = await getFileUrl(account.seedr_access_token, file.folder_file_id);
                            if (fileUrl) {
                                m3u8Content += `#EXTINF:-1,${file.name}\n`;
                                m3u8Content += `${fileUrl}\n`;
                                totalVideos++;
                            }
                        }
                    }
                    catch (error) {
                        console.error(`Failed to process folder ${folder.id}:`, error);
                    }
                }
            }
            catch (error) {
                console.error(`Failed to get folders for account ${account.id}:`, error);
            }
        }
        if (totalVideos === 0) {
            return c.json({ success: false, error: 'No video files found' }, 400);
        }
        const githubUrl = await uploadM3U8ToGitHub(c.env, m3u8Content, `${sessionId}-personal.m3u8`);
        return c.json({
            success: true,
            githubUrl,
            videoCount: totalVideos
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
export default seedrRouter;
