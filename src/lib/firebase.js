import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * Firebaseの設定値はTMDBトークンと違って秘密ではない。
 * VITE_を付けてバンドルに入っても問題ない——実際のアクセス制御は
 * Firestoreのセキュリティルール（firebase/firestore.rules）と
 * Authenticationの「許可済みドメイン」で行う。
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 未設定なら null を返し、entries.js が localStorage 側に倒れる。
// アカウントを作る前でもアプリ全体を動かして確認できるようにするため。
export const hasFirebase = Boolean(config.apiKey && config.projectId)

const app = hasFirebase ? initializeApp(config) : null
export const auth = hasFirebase ? getAuth(app) : null
export const db = hasFirebase ? getFirestore(app) : null
