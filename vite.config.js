import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { proxyTmdb } from './api/_core.js'

/**
 * devサーバでも本番と同じ /api/tmdb が使えるようにする。
 * これが無いと `vercel dev` を入れないとローカルで検索できない。
 * 本番の api/tmdb.js と同じ proxyTmdb を呼んでいるので挙動はズレない。
 */
function tmdbDevProxy(token) {
  return {
    name: 'tmdb-dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/tmdb', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const { status, body } = await proxyTmdb(url.searchParams, token)
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(body))
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // 第3引数を '' にすると VITE_ 以外の変数も読める。
  // TMDB_TOKEN は VITE_ を付けないので、クライアントのバンドルには入らない。
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tmdbDevProxy(env.TMDB_TOKEN)],
    server: { host: true },
  }
})
