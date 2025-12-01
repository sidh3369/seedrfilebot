export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-block p-4 bg-purple-500/20 rounded-2xl mb-6 backdrop-blur-sm">
              <svg className="w-16 h-16 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h1 className="text-5xl font-bold text-white mb-4">
              SeedrSync Bot
            </h1>
            <p className="text-xl text-purple-200">
              Seamlessly download torrents to Seedr and sync video playlists to GitHub
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-purple-500/30 rounded-lg">
                  <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Instant Downloads</h3>
                  <p className="text-purple-200">Send magnet links and let Seedr handle the downloading</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-purple-500/30 rounded-lg">
                  <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Auto M3U8 Playlists</h3>
                  <p className="text-purple-200">Automatically extract video links and create M3U8 playlists</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-purple-500/30 rounded-lg">
                  <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">GitHub Storage</h3>
                  <p className="text-purple-200">Store playlists on GitHub for easy access anywhere</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-purple-500/30 rounded-lg">
                  <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Secure OAuth</h3>
                  <p className="text-purple-200">One-time device code authentication with Seedr</p>
                </div>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">How It Works</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Connect Your Seedr Account</h4>
                  <p className="text-purple-200">Use /auth command to link your Seedr account via device code</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Send Magnet Links</h4>
                  <p className="text-purple-200">Simply paste any magnet link into the chat</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  3
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-1">Get Your Playlist</h4>
                  <p className="text-purple-200">Receive a GitHub URL with your M3U8 playlist containing all video links</p>
                </div>
              </div>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-md rounded-xl p-8 border border-white/20 mb-12">
            <h2 className="text-2xl font-bold text-white mb-4">Setup Required</h2>
            <div className="space-y-3 text-purple-100">
              <p>Before using the bot, configure these environment variables:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><code className="bg-black/30 px-2 py-1 rounded">TELEGRAM_BOT_TOKEN</code> - Your Telegram bot token from @BotFather</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">GITHUB_TOKEN</code> - GitHub personal access token with repo permissions</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">GITHUB_REPO_OWNER</code> - Your GitHub username</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">GITHUB_REPO_NAME</code> - Repository name for storing playlists</li>
              </ul>
            </div>
          </div>

          {/* Dashboard Link */}
          <div className="text-center">
            <a
              href="/dashboard"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg shadow-purple-500/50"
            >
              🎛️ Open Admin Dashboard
            </a>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 text-purple-300">
            <p>Made with ❤️ by Shailesh Patel</p>
          </div>
        </div>
      </div>
    </div>
  );
}
