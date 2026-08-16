const API = 'https://api.themoviedb.org/3'

// このアプリが実際に叩くエンドポイントだけを通す。
// path をそのまま連結する作りなので、開けたままにすると
// 誰でも自分のトークンで任意のTMDB APIを呼べる踏み台になる。
const ALLOWED = [/^\/search\/movie$/, /^\/movie\/\d+$/]

/**
 * TMDBへの中継。dev（Viteミドルウェア）と本番（Vercel関数）の両方から呼ばれる。
 * トークンは呼び出し側がサーバの環境変数から渡す。ブラウザには絶対に出さない。
 */
export async function proxyTmdb(searchParams, token) {
  if (!token || !token.trim()) {
    return {
      status: 500,
      body: { error: 'サーバにTMDBのトークンが設定されていません（環境変数 TMDB_TOKEN）。' },
    }
  }

  const path = searchParams.get('path')
  if (!path || !ALLOWED.some((re) => re.test(path))) {
    return { status: 400, body: { error: `許可されていないパスです: ${path ?? '(なし)'}` } }
  }

  const url = new URL(API + path)
  for (const [key, value] of searchParams) {
    if (key !== 'path') url.searchParams.set(key, value)
  }

  let res
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    })
  } catch {
    return { status: 502, body: { error: 'TMDBに接続できませんでした。' } }
  }

  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}
