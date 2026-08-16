// cinema-roadmap の src/lib/tmdb.js が原型。
// 違いは (1) トークンを持たず /api/tmdb 経由で叩く点、
// (2) 公開日ではなく runtime / genres を取る点、
// (3) タイトル・監督名・ジャンルを en-US で統一して取る点
//     （ja-JPだと邦題と英題が入り乱れて棚と星図の見た目が揃わないため）。
const IMG = 'https://image.tmdb.org/t/p'

async function get(path, params = {}) {
  const url = new URL('/api/tmdb', location.origin)
  url.searchParams.set('path', path)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  }

  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))

  if (res.status === 401) {
    throw new Error('TMDBトークンが無効です。サーバの TMDB_TOKEN を確認してください。')
  }
  if (res.status === 429) {
    throw new Error('TMDBのレート制限に達しました。少し待ってから再試行してください。')
  }
  if (!res.ok) {
    throw new Error(data.error ?? `TMDBリクエスト失敗 (${res.status})`)
  }
  return data
}

export const posterUrl = (path, size = 'w500') => (path ? `${IMG}/${size}${path}` : null)

/** ポスター候補を「日本版 → 英語版 → 言語なし」の順に並べて返す */
export function pickPosters(detail) {
  const rank = (lang) => (lang === 'ja' ? 0 : lang === 'en' ? 1 : 2)
  const fromImages = (detail?.images?.posters ?? [])
    .slice()
    .sort(
      (a, b) =>
        rank(a.iso_639_1) - rank(b.iso_639_1) || (b.vote_average ?? 0) - (a.vote_average ?? 0)
    )
    .map((p) => p.file_path)

  const unique = [...new Set([detail?.poster_path, ...fromImages].filter(Boolean))]

  const jaFirst = fromImages.find(
    (p) => detail.images.posters.find((x) => x.file_path === p)?.iso_639_1 === 'ja'
  )
  if (jaFirst) return [jaFirst, ...unique.filter((p) => p !== jaFirst)].slice(0, 12)
  return unique.slice(0, 12)
}

function pickCredits(detail) {
  const director = (detail?.credits?.crew ?? []).find((c) => c.job === 'Director')?.name ?? ''
  const cast = (detail?.credits?.cast ?? []).slice(0, 3).map((c) => c.name)
  return { director, cast }
}

export async function searchMovies(query) {
  const data = await get('/search/movie', {
    query,
    language: 'en-US',
    include_adult: 'false',
    page: 1,
  })
  return (data.results ?? []).map((m) => ({
    tmdbId: m.id,
    title: m.title || m.original_title,
    originalTitle: m.original_title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    posterPath: m.poster_path,
    popularity: m.popularity,
  }))
}

/** 選択した作品の詳細を取り、entries に保存する形へ正規化する */
export async function fetchMovieEntry(tmdbId) {
  const detail = await get(`/movie/${tmdbId}`, {
    language: 'en-US',
    append_to_response: 'credits,images',
    include_image_language: 'ja,en,null',
  })

  const posters = pickPosters(detail)
  const { director, cast } = pickCredits(detail)

  return {
    tmdbId: detail.id,
    title: detail.title || detail.original_title,
    originalTitle: detail.original_title ?? '',
    releaseYear: detail.release_date ? Number(detail.release_date.slice(0, 4)) : null,
    posterPath: posters[0] ?? detail.poster_path ?? null,
    posterCandidates: posters,
    runtime: detail.runtime || null,
    genres: (detail.genres ?? []).map((g) => g.name),
    director,
    castNames: cast,
    overview: detail.overview ?? '',
  }
}
