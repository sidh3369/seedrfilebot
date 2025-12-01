import { Hono } from "hono";
import { Env } from './env';
import { createWebhookHandler, clearActiveDownloads, setupBotCommands } from './telegram-bot';
import { getFolderContents, getFiles, getFileUrl } from './seedr';
import seedrRouter from './seedr-api';

const app = new Hono<{ Bindings: Env }>();

// Mount seedr routes
app.route('/api/seedr', seedrRouter);

app.post('/webhook', async (c) => {
  try {
    const handler = createWebhookHandler(c.env);
    return handler(c);
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ ok: true }, 200);
  }
});

app.get('/', (c) => {
  return c.text('SeedrSync Bot is running');
});

// Reset endpoint to clear stuck downloads
app.post('/api/reset', async (c) => {
  try {
    clearActiveDownloads();
    await setupBotCommands(c.env);
    
    return c.json({ 
      success: true, 
      message: 'Bot reset successfully. All stuck downloads cleared and commands updated.' 
    });
  } catch (error: any) {
    console.error('[RESET] Error:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// Initialize bot commands on first request
let commandsInitialized = false;
app.use('*', async (c, next) => {
  if (!commandsInitialized) {
    try {
      await setupBotCommands(c.env);
      commandsInitialized = true;
    } catch (error) {
      console.error('[INIT] Failed to set commands:', error);
    }
  }
  await next();
});

export default {
  fetch: app.fetch,
  
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    console.log('[CRON] Starting daily M3U8 update for all users...');
    
    try {
      // Get all active users with Seedr accounts
      const { results: users } = await env.DB.prepare(
        'SELECT DISTINCT telegram_user_id FROM users WHERE id IN (SELECT user_id FROM seedr_accounts WHERE is_active = 1)'
      ).all<{ telegram_user_id: string }>();

      if (!users || users.length === 0) {
        console.log('[CRON] No users with active accounts found');
        return;
      }

      const { uploadM3U8ToGitHub } = await import('./github');

      console.log(`[CRON] Updating playlists for ${users.length} users`);

      for (const user of users) {
        try {
          // Get user's accounts
          const { results: accounts } = await env.DB.prepare(
            'SELECT * FROM seedr_accounts WHERE user_id = (SELECT id FROM users WHERE telegram_user_id = ?) AND is_active = 1'
          ).bind(user.telegram_user_id).all<any>();

          if (!accounts || accounts.length === 0) continue;

          let m3u8Content = '#EXTM3U\n';
          let totalVideos = 0;

          for (const account of accounts) {
            try {
              const folders = await getFolderContents(account.seedr_access_token);
              
              for (const folder of folders) {
                try {
                  const files = await getFiles(account.seedr_access_token, folder.id);
                  const videoFiles = files.filter((f: any) => 
                    f.play_video && (
                      f.name.endsWith('.mp4') || 
                      f.name.endsWith('.mkv') || 
                      f.name.endsWith('.avi') ||
                      f.name.endsWith('.mov')
                    )
                  );

                  for (const file of videoFiles) {
                    const fileUrl = await getFileUrl(account.seedr_access_token, file.folder_file_id);
                    if (fileUrl) {
                      m3u8Content += `#EXTINF:-1,${file.name}\n`;
                      m3u8Content += `${fileUrl}\n`;
                      totalVideos++;
                    }
                  }
                } catch (error) {
                  console.error(`[CRON] Failed to process folder ${folder.id}:`, error);
                }
              }
            } catch (error) {
              console.error('[CRON] Failed to get folders:', error);
            }
          }

          if (totalVideos > 0) {
            const filename = user.telegram_user_id.startsWith('session_') 
              ? `${user.telegram_user_id}-personal.m3u8`
              : `user-${user.telegram_user_id}.m3u8`;
            const githubUrl = await uploadM3U8ToGitHub(env, m3u8Content, filename);
            console.log(`[CRON] Updated ${filename} with ${totalVideos} videos: ${githubUrl}`);
          } else {
            console.log(`[CRON] No videos found for user ${user.telegram_user_id}`);
          }
        } catch (error) {
          console.error(`[CRON] Error updating playlist for user ${user.telegram_user_id}:`, error);
        }
      }
      
      console.log('[CRON] Daily update completed');
    } catch (error) {
      console.error('[CRON] Error in scheduled update:', error);
    }
  }
};
