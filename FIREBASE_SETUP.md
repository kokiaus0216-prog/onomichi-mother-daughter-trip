# かえでとゆかの母娘旅行 in尾道｜2人で旅程を共有編集する設定

サイトURL： https://kokiaus0216-prog.github.io/onomichi-mother-daughter-trip/

## ここまで実装済み

- 2人のGoogleログイン（Firebase Authentication）
- Firestoreの共有旅程（同じ旅行データをリアルタイム監視）
- 日付・時刻・場所・Googleマップ・説明の編集と、予定の追加・削除
- 鉄道・バスなら発着駅・発着時刻・座席等の情報も編集
- 更新内容を中央タイムラインと上部の「2日間の予定をひと目で」に反映
- 変更時の同時編集競合を軽減するFirestoreトランザクション
- 重要な交通予定の時刻変更時には確認
- 未接続でも従来のしおりを表示（既存の写真・費用管理も維持）

**重要：コードは完成していますが、Firebaseプロジェクトへの接続設定はまだです。** 初期設定完了後、両者のスマホで同期が開始します。

## ステップ1：Firebaseプロジェクトを作成する

1. https://console.firebase.google.com/ を開く
2. 「プロジェクトを追加」で専用のプロジェクトを作る（例：onomichi-trip-2026）
3. 「プロジェクトの設定」→「マイアプリ」→ウェブアプリ「</>」を追加
4. 表示される firebaseConfig の `apiKey`, `authDomain`, `projectId`, `appId` 等をコピーする
5. GitHubの `firebase-config.js` の `null` を次のようなオブジェクトに置き換える：

```js
export const firebaseConfig = {
  apiKey: "Firebase Consoleで表示された値",
  authDomain: "プロジェクトID.firebaseapp.com",
  projectId: "プロジェクトID",
  storageBucket: "必要ならFirebase Consoleの値",
  messagingSenderId: "Firebase Consoleの値",
  appId: "Firebase Consoleの値"
};
```

Webアプリの Firebase 設定は公開用のクライアント設定です。**サービスアカウントJSON、秘密鍵、管理者用トークン、パスワードは絶対にGitHubへ置かないでください。** 実際のアクセス可否は認証とFirestoreルールで決まります。

## ステップ2：Googleログインの設定

1. Firebase Console → Authentication → Sign-in method → Googleを有効にする
2. Authentication → Settings → Authorized domains で次のドメインを追加
   `kokiaus0216-prog.github.io`
3. GitHub PagesのサイトをSafariまたはChromeで直接開く
4. しおりの「✏️ ふたりで旅程を編集」を開き「Googleでログイン」をタップ
5. かえで・ゆかがそれぞれのGoogleアカウントでログインする
6. それぞれ「自分のUIDをコピー」でFirebase AuthのUIDを取得する

**この時点ではまだ「アクセス権がありません」と表示されても正常です。** ルールにUIDを登録していないためです。

※ iPhoneのLINE内ブラウザではログインポップアップが制限される場合があるため、Safariでの利用を推奨します。

## ステップ3：Cloud Firestoreを作成し、アクセスルールを設定

1. Firebase Console → Firestore Database → 「データベースを作成」
2. 本番（Production）モードを選択（全公開のテストルールにはしない）
3. Firestore → Rules（ルール）を開く
4. リポジトリの `firestore.rules` にある内容をコピーする
5. `REPLACE_WITH_KAEDE_UID`, `REPLACE_WITH_YUKA_UID` をそれぞれコピーしたUIDへ置き換える
6. 管理者も編集したい場合だけ、`REPLACE_WITH_OWNER_UID_IF_NEEDED` をそのUIDに置き換える。管理者不要なら最後の条件を削除する
7. Publish（公開）を押す

**注意：** `firestore.rules` はGitHubに置くだけではFirebaseへ適用されません。Firestore Consoleの Rules画面で公開してください。既存のFirebaseプロジェクトにほかのアプリがある場合は、ほかのルールを消してしまわないように注意してください。

## ステップ4：2人の同期を開始する

1. かえでかゆかのどちらかが、サイトを更新してGoogleログインする
2. 「現在の旅程を共有開始」を1回だけ押す（Firestoreに初期旅程をコピー）
3. もう一人がログインすると、同じ旅程が自動表示される
4. 「編集モードをON」を押すと、各予定に「✎ 編集」ボタンが出る
5. 内容を変更し「2人の旅程に保存」を押すと、相手のスマホにも自動反映される
6. 「＋予定を追加」から新しい行き先やカフェ等を追加できる

同時に編集しても、Firestoreのトランザクションがデータの競合を軽減します。ただし、**同じ予定を同時編集した場合は後から保存した変更が優先**されます。

## データの扱いと注意点

- **今回同期されるのは旅程だけ。** 写真アルバム・旅費・持ち物チェックは、これまでどおり各端末に保存され、まだ2人で自動同期はしません。
- GitHub Pages自体は公開サイトです。既存の初期旅程、名前、座席番号などはHTMLソースにも入っているため、Firebaseのルールを設定しても**既存の掲載情報まで非公開になるわけではありません**。閲覧自体も2人に限定したい場合は、サイト構成の変更が必要です。
- 無関係なGoogleアカウントでもGoogleログイン画面は開けますが、UIDをルールに登録していない限りFirestoreへの読み書きはできません。
- Firebaseの利用料は使用量・プランによって異なります。利用枠と課金設定を確認し、必要ならGoogle Cloudの予算アラートを設定してください。
- サイトの「現在」マーカーは時刻からの推定で、GPSの現在地追跡や交通機関の遅延検知ではありません。
- Firestoreには編集者名と更新時刻が保存されます。LINEグループ通知はこの段階ではまだ実装していません。

## 公式ドキュメント

- Firebase Webアプリ設定：https://firebase.google.com/docs/web/setup
- Googleログイン：https://firebase.google.com/docs/auth/web/google-signin
- Firestoreのリアルタイム更新：https://firebase.google.com/docs/firestore/query-data/listen
- Firestoreセキュリティ：https://firebase.google.com/docs/firestore/security/get-started

Firebase Web SDK 13.4.0（2026-11-16公開）を利用しています。
