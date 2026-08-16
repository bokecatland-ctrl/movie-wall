import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db, hasFirebase } from './firebase.js'

/**
 * データの唯一の出入口。コンポーネントからFirebaseを直接触らせない。
 * ここさえ差し替えれば保存先を丸ごと変えられる
 * （実際、最初はSupabaseで作ってこのファイルだけ差し替えた）。
 *
 * Firebaseが未設定のときは localStorage に落ちる。機能は完全に同じで、
 * 端末をまたげないだけ。
 */

const LOCAL_KEY = 'movie-wall:entries:v1'

export const backend = hasFirebase ? 'firebase' : 'local'

// Firestoreは `users/{uid}/entries/{entryId}` のサブコレクションに1人分をまとめる。
// トップレベルに entries を1本作って user_id で絞るSupabase流より、
// こちらのほうがFirestoreのセキュリティルールが素直に書ける。
function entriesCollection() {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('ログインしていません。')
  return collection(db, 'users', uid, 'entries')
}

// ── localStorage 側 ──────────────────────────────────

function localRead() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function localWrite(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list))
}

// ── 公開API ──────────────────────────────────────────

export async function listEntries() {
  if (!hasFirebase) return localRead()

  // watchedOn/createdAtの2段ソートをFirestore側に頼むと複合インデックスが要る
  // （作っていないとクエリごと失敗し、保存はできるのに一覧だけ空に見える）。
  // 個人用の規模なら並び替えはこちらでやれば十分で、インデックス管理が要らなくなる。
  const snap = await getDocs(entriesCollection())
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        a.watchedOn.localeCompare(b.watchedOn) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    )
}

/** 同じ日に同じ作品が既に記録されていないか。DBの一意制約が無いFirestoreでは自前で見る */
async function existsSameDay(tmdbId, watchedOn) {
  const snap = await getDocs(
    query(
      entriesCollection(),
      where('tmdbId', '==', tmdbId),
      where('watchedOn', '==', watchedOn),
      limit(1)
    )
  )
  return !snap.empty
}

/** 保存して、確定した1件（idつき）を返す */
export async function addEntry(entry) {
  if (!hasFirebase) {
    const saved = { ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
    localWrite([...localRead(), saved])
    return saved
  }

  if (await existsSameDay(entry.tmdbId, entry.watchedOn)) {
    throw new Error('その日付で同じ作品がすでに記録されています。')
  }

  const payload = { ...entry, createdAt: new Date().toISOString() }
  try {
    const ref = await addDoc(entriesCollection(), payload)
    return { id: ref.id, ...payload }
  } catch (e) {
    throw new Error(`保存に失敗しました: ${e.message}`)
  }
}

export async function updateEntry(id, patch) {
  if (!hasFirebase) {
    const list = localRead().map((e) => (e.id === id ? { ...e, ...patch } : e))
    localWrite(list)
    return list.find((e) => e.id === id)
  }

  try {
    await updateDoc(doc(entriesCollection(), id), patch)
    return { id, ...patch }
  } catch (e) {
    throw new Error(`更新に失敗しました: ${e.message}`)
  }
}

export async function removeEntry(id) {
  if (!hasFirebase) {
    localWrite(localRead().filter((e) => e.id !== id))
    return
  }
  try {
    await deleteDoc(doc(entriesCollection(), id))
  } catch (e) {
    throw new Error(`削除に失敗しました: ${e.message}`)
  }
}

/** バックアップJSONの取り込み。既存に無いものだけ足す */
export async function importEntries(list) {
  const existing = await listEntries()
  const seen = new Set(existing.map((e) => `${e.tmdbId}:${e.watchedOn}`))
  const fresh = list.filter((e) => !seen.has(`${e.tmdbId}:${e.watchedOn}`))

  for (const e of fresh) {
    const { id, createdAt, ...rest } = e // eslint-disable-line no-unused-vars
    await addEntry(rest)
  }
  return fresh.length
}
