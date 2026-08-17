import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  getRedirectResult,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithRedirect,
} from 'firebase/auth'
import { auth } from '../lib/firebase.js'

// 送信したメールを覚えておく場所。リンクを開いた端末が送信時と同じなら
// 聞き直さずにログインできる。別の端末で開いたときだけ後で入力を求める。
const PENDING_KEY = 'movie-wall:pending-email'

const googleProvider = new GoogleAuthProvider()

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  )
}

/**
 * ログイン方法は2つ。
 *   Google — ワンタップで済み、送信数の上限も無い。基本こちらを使う想定。
 *   メールリンク — Googleを使いたくない/使えないときの保険。
 *     Firebase Sparkプランは1日の送信数に上限があるので、
 *     Googleを主役にしてこちらは控えめに置いている。
 */
export default function Auth() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resolving, setResolving] = useState(true)

  // 起点は3通り：ふつうに開いた／メールリンクで戻ってきた／Googleのリダイレクトで戻ってきた。
  // 後の2つは非同期でしか判定できないので、どちらも試してから初めてフォームを出す。
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let stored = window.localStorage.getItem(PENDING_KEY)
        if (!stored) {
          // 送信した端末と違うと分からないので、確認のためもう一度だけ聞く
          stored = window.prompt('Please re-enter the email address you used to sign in')
        }
        if (stored) {
          try {
            await signInWithEmailLink(auth, stored, window.location.href)
            window.localStorage.removeItem(PENDING_KEY)
            // リンクのクエリを残したままだとリロードのたびにこの処理が走る
            window.history.replaceState({}, '', window.location.pathname)
          } catch (e) {
            if (alive) setError(e.message)
          }
        }
      } else {
        // 保留中のGoogleリダイレクトが無ければ、これはほぼ一瞬で解決する
        try {
          await getRedirectResult(auth)
        } catch (e) {
          if (alive) setError(e.message)
        }
      }
      if (alive) setResolving(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  async function signInGoogle() {
    setError('')
    try {
      await signInWithRedirect(auth, googleProvider)
    } catch (e) {
      setError(e.message)
    }
  }

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

  if (resolving) return <div className="boot">Signing in…</div>

  return (
    <div className="auth">
      <h1 className="auth__logo">MOVIE WALL</h1>
      {sent ? (
        <p className="auth__msg">
          We sent a login link to {email}.
          <br />
          Open your email and click the link.
        </p>
      ) : (
        <div className="auth__form">
          <button type="button" className="auth__google" onClick={signInGoogle}>
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="auth__divider">
            <span>or</span>
          </div>

          <form onSubmit={send} className="auth__email">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="ghost" disabled={busy || !email.trim()}>
              {busy ? 'Sending…' : 'Send login link'}
            </button>
          </form>
        </div>
      )}
      {error && <p className="notice notice--error">{error}</p>}
    </div>
  )
}
