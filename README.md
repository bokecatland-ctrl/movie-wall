# movie wall

観た映画を、**棚**と**星図**という2つの姿で見るための個人用サイト。

同じ記録を切り替えて見る。

- **棚** — 1本＝1枚の背表紙。上映時間がそのまま厚みになり、ポスターから抽出した色が地色、裾に★が焼き込まれる。背表紙を押すと手前に回って表紙が正面を向く。
- **星図** — 1本＝1つの星。★が明るさ、ジャンルが方角、公開年が距離（古い映画ほど遠い）。同じ監督の作品が線で結ばれ「ノーラン座」のような星座になる。

星の位置は作品から決まるので、**同じ映画はいつ見ても同じ場所にいる**。

## 使いはじめる

```bash
npm install
```

`.env.example` を `.env.local` にコピーしてTMDBのトークンを入れる。

```
TMDB_TOKEN=eyJhbGciOi...
```

> `VITE_` を付けないこと。付けるとバンドルに焼き込まれ、公開URLからトークンが誰でも読めます。
> トークンは `cinema-roadmap/.env.local` にあるものと同じで構いません（1つのTMDBアカウントで複数アプリに使えます）。

```bash
npm run dev
```

http://localhost:5173 を開く。右下の **＋** から検索して★を付ければ棚に入る。

この時点ではデータは**このブラウザのlocalStorage**にだけ入っている。1台で使うならこのままで完結する。

## スマホからも記録したいとき

Firebaseに繋ぐと端末をまたげる。**プロジェクト作成とキーの発行は自分でやる必要がある**（5分ほど）。

1. https://console.firebase.google.com で新しいプロジェクトを作る（既存のFirebaseアカウントでOK）
2. プロジェクト概要の **「\</\>」（ウェブアプリを追加）** をクリックし、出てきた設定オブジェクトの値を `.env.local` に入れる

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxxxx
VITE_FIREBASE_STORAGE_BUCKET=xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

3. 左メニュー **Authentication → Sign-in method** で **メールリンク（パスワードなしのログイン）** を有効化する
4. 左メニュー **Firestore Database** → データベースを作成 → 左メニュー **ルール** に [`firebase/firestore.rules`](firebase/firestore.rules) の中身を貼って **公開**

devサーバを再起動すると、メールアドレスを入れてログインリンクを受け取る画面になる。パスワードは作らない。

セキュリティルールで「自分のuidの下だけ、ログインしている本人だけ読み書きできる」ようにしてあるので、設定値が見える状態でも他人が自分の記録を読むことはできない。

### 既にlocalStorageに溜めた分を移す

Firebaseに繋ぐ前に `⋯ → JSONで書き出す` で保存し、繋いだあとに `⋯ → JSONを読み込む` で取り込む。

## 公開する（Vercel）

1. このフォルダをGitHubのリポジトリに上げる（`.env.local` は `.gitignore` 済み）
2. https://vercel.com でリポジトリをインポート。Viteとして自動検出される
3. **Settings → Environment Variables** に7つ登録する

| 変数 | 値 |
|---|---|
| `TMDB_TOKEN` | TMDBのRead Access Token |
| `VITE_FIREBASE_API_KEY` 他6つ | Firebaseのウェブアプリ設定の値 |

4. Firebaseの **Authentication → Settings → 承認済みドメイン** に、発行されたVercelのURL（`xxxxx.vercel.app`）を追加する（これを忘れるとログインリンクを踏んでも弾かれる）

スマホでそのURLを開き「ホーム画面に追加」すると、アドレスバーなしのアプリとして起動する。

## 仕組みで知っておくとよいこと

**TMDBのトークンはブラウザに出さない。** `api/tmdb.js`（Vercelのサーバレス関数）が中継し、トークンはサーバ側で付ける。devサーバでも同じ動きをするよう、`vite.config.js` が同じ関数をミドルウェアとして噛ませている。だから `vercel dev` は要らない。中継できるパスは `/search/movie` と `/movie/{id}` だけに絞ってある（開けたままだと他人の踏み台になるため）。

このプロキシは意図的にFirebaseに移していない。Firebase Cloud FunctionsはTMDBのような外部APIへの通信にBlazeプラン（従量課金・要クレジットカード）を要求するが、Vercelの関数は無料枠のままで呼べる。DBと認証だけFirebaseに任せ、TMDB中継はVercel側に残しているのはそのため。

**背表紙の色はポスターから決まる。** 保存時に `src/lib/color.js` がポスターを48pxに縮めて色を数え、黒帯・白フチ・グレーを票から外した最頻色を採る。彩度と明度だけ棚に馴染む帯に収め、色相は動かさない（作品の色の記憶はそこに乗っているので）。

**同じ映画を観るたびに1本増える。** Firestoreには一意制約が無いので、保存前に「同じtmdb_id・同じ日付」を自前で確認して弾いている（`src/lib/entries.js` の `existsSameDay`）。同じ日の二重登録だけを防ぐ設計で、再鑑賞は別の記録として増え、背表紙の上端に小さなドットが付く。

**データの出入口は `src/lib/entries.js` だけ。** コンポーネントからFirebaseを直接呼ばないので、保存先を変えたくなったらこの1ファイルを差し替えれば済む（実際、最初はSupabaseで作ってこのファイルだけ差し替えた）。Firebase未設定時にlocalStorageへ倒れるのも同じ仕組み。

## 見た目を変える

- 色: `src/styles/theme.css` の CSS変数。棚板は `--plank`、夜空は `--sky-far` / `--sky-near`、★は `--star`
- 背表紙の厚み: `src/lib/layout-shelf.js` の `spineWidth()`。上映時間から幅を出す式を変えれば全体が連動する
- 背の高さのばらつき: 同ファイルの `spineHeight()`。`seeded()` で作品ごとに固定しているので、リロードしても棚は同じ形のまま
- 星の配置: `src/lib/layout-sky.js` の `starPosition()`。角度＝ジャンル、距離＝公開年をここで決めている
- 節目の演出: `src/components/Shelf.jsx` の `MILESTONES`
- アイコン: `node scripts/make-icons.mjs` で再生成（依存なしでPNGを直接書いている）

## 出典

このプロダクトはTMDBのAPIを利用していますが、TMDBによる承認・認定を受けたものではありません。ポスター画像は配給会社・製作会社の著作物です。
