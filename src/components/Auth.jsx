import { useEffect, useState } from 'react'
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from 'firebase/auth'
import { auth } from '../lib/firebase.js'

// 送信したメールを覚えておく場所。リンクを開いた端末が送信時と同じなら
// 聞き直さずにログインできる。別の端末で開いたときだけ後で入力を求める。
const PENDING_KEY = 'movie-wall:pending-email'

/**
 * メールにリンクが届いて、押すとログインできる方式。
 * パスワードを作らず・覚えず・入力しないので、スマホから一番楽に入れる。
 */
export default function Auth() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // 初回レンダー時点で判定を確定させる（＝effectの外）。
  // これをuseEffect側でsetStateすると、確定するまでの一瞬フォームが見えてしまう。
  const [completing, setCompleting] = useState(() =>
    isSignInWithEmailLink(auth, window.location.href)
  )

  // リンクを踏んで戻ってきたときの後始末
  useEffect(() => {
    if (!completing) return
    ;(async () => {
      let stored = window.localStorage.getItem(PENDING_KEY)
      if (!stored) {
        // 送信した端末と違うと分からないので、確認のためもう一度だけ聞く
        stored = window.prompt('確認のため、送信したメールアドレスを入力してください')
      }
      if (!stored) {
        setCompleting(false)
        return
      }
      try {
        await signInWithEmailLink(auth, stored, window.location.href)
        window.localStorage.removeItem(PENDING_KEY)
        // リンクのクエリを残したままだとリロードのたびにこの処理が走る
        window.history.replaceState({}, '', window.location.pathname)
      } catch (e) {
        setError(e.message)
      } finally {
        setCompleting(false)
      }
    })()
  }, [completing])

  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await sendSignInLinkToEmail(auth, email.trim(), {
        url: window.location.origin,
        handleCodeInApp: true,
      })
      window.localStorage.setItem(PENDING_KEY, email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (completing) return <div className="boot">ログイン中…</div>

  return (
    <div className="auth">
      <h1 className="auth__logo">MOVIE WALL</h1>
      {sent ? (
        <p className="auth__msg">
          {email} にログイン用のリンクを送りました。
          <br />
          メールを開いてリンクを押してください。
        </p>
      ) : (
        <form onSubmit={send} className="auth__form">
          <label htmlFor="email">メールアドレス</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="primary" disabled={busy || !email.trim()}>
            {busy ? '送信中…' : 'ログインリンクを送る'}
          </button>
          {error && <p className="notice notice--error">{error}</p>}
        </form>
      )}
    </div>
  )
}
