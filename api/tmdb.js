import { proxyTmdb } from './_core.js'

/** Vercel Serverless Function: /api/tmdb?path=/search/movie&query=... */
export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
  const { status, body } = await proxyTmdb(url.searchParams, process.env.TMDB_TOKEN)

  // TMDBのレスポンスは同じクエリなら変わらないので、Vercelのエッジに寝かせて
  // レート制限とレイテンシの両方を減らす。
  if (status === 200) res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate')
  res.status(status).json(body)
}
